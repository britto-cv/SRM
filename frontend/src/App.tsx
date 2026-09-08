import { useState, useEffect, useRef } from 'react';
import type { ConnectionState, NormalizedStudentData } from '@srm/shared';
import { Dashboard } from './components/Dashboard';
import { LandingPage } from './components/LandingPage';
import { ManualSubjectEntry, loadManualSubjects } from './components/ManualSubjectEntry';
import type { ManualSubject } from './components/ManualSubjectEntry';
import { TopNav } from './components/TopNav';
import type { TabType } from './components/TopNav';
import { BottomNav } from './components/BottomNav';
import { SettingsModal } from './components/SettingsModal';
import { PwaInstallPrompt } from './components/PwaInstallPrompt';
import { PortalSyncModal } from './components/PortalSyncModal';
import { CredentialsForm } from './components/CredentialsForm';
import { apiFetch } from './utils/api';
import './App.css';

/** Build a NormalizedStudentData from manually entered subjects */
function buildManualStudentData(subjects: ManualSubject[]): NormalizedStudentData {
  return {
    profile: {
      name: 'Manual Entry',
      studentId: '—',
      program: 'Manual Mode',
      department: '—',
    },
    currentSemester: { id: 'manual', name: 'Manual Entry' },
    subjects: subjects.map(s => ({ code: s.code, name: s.name, credits: s.credits })),
    attendance: subjects.map(s => ({
      subjectCode: s.code,
      attendedHours: s.attendedHours,
      conductedHours: s.conductedHours,
      percentage: s.conductedHours === 0 ? 0 : (s.attendedHours / s.conductedHours) * 100,
    })),
  };
}

function App() {
  const [appState, setAppState] = useState<ConnectionState>('DISCONNECTED');
  const [statusDetail, setStatusDetail] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [studentData, setStudentData] = useState<NormalizedStudentData | null>(null);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualSubjects, setManualSubjects] = useState<ManualSubject[]>([]);
  const [isManualMode, setIsManualMode] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('health');
  const [showSettings, setShowSettings] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [captchaBase64, setCaptchaBase64] = useState<string | null>(null);
  const [targetRefresh, setTargetRefresh] = useState(0);

  // Use refs to track current state to avoid stale closures in polling
  const appStateRef = useRef(appState);
  const sessionIdRef = useRef(sessionId);
  
  useEffect(() => {
    appStateRef.current = appState;
  }, [appState]);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  // On mount — load any previously saved manual subjects
  useEffect(() => {
    const saved = loadManualSubjects();
    if (saved && saved.length > 0) {
      setManualSubjects(saved);
    }
  }, []);

  // Check for 1-Click Portal Sync payload in URL hash
  useEffect(() => {
    if (window.location.hash && window.location.hash.includes('srm_data=')) {
      try {
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        const rawData = params.get('srm_data');
        if (rawData) {
          const parsed = JSON.parse(decodeURIComponent(rawData));
          if (parsed && parsed.subjects && parsed.attendance) {
            setStudentData(parsed);
            setAppState('DATA_READY');
            setIsManualMode(false);
            setActiveTab('health');
            setStatusDetail('Attendance synchronized from SRMIST Portal');
            // Clean up the URL hash immediately to prevent leaking in history
            window.history.replaceState(null, '', window.location.pathname);
          }
        }
      } catch (e) {
        console.error('Failed to parse synchronized data from URL:', e);
      }
    }
  }, []);

  // Polling logic for auth state
  useEffect(() => {
    let timeoutId: any;

    const pollStatus = async () => {
      try {
        const queryParam = sessionIdRef.current ? `?sessionId=${encodeURIComponent(sessionIdRef.current)}` : '';
        const res = await apiFetch(`/api/connect/status${queryParam}`);
        if (res.ok) {
          const data = await res.json();
          const newState = data.state;
          if (data.detail) {
            setStatusDetail(data.detail);
          }
          if (data.sessionId && !sessionIdRef.current) {
            setSessionId(data.sessionId);
          }
          if (data.captchaBase64) {
            setCaptchaBase64(data.captchaBase64);
          }
          
          if (newState !== appStateRef.current) {
            setAppState(newState);
            
            if (newState === 'DATA_READY') {
              fetchData(data.sessionId || sessionIdRef.current);
            }
          }
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
      
      // Continue polling if in active connection lifecycle
      if (['LAUNCHING', 'WAITING_FOR_LOGIN', 'AUTHENTICATING', 'LOGIN_FAILED', 'AUTHENTICATED', 'EXTRACTING'].includes(appStateRef.current)) {
        timeoutId = setTimeout(pollStatus, 1200);
      }
    };

    if (['LAUNCHING', 'WAITING_FOR_LOGIN', 'AUTHENTICATING', 'LOGIN_FAILED', 'AUTHENTICATED', 'EXTRACTING'].includes(appState)) {
      timeoutId = setTimeout(pollStatus, 1200);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [appState]);

  const fetchData = async (_sid?: string | null) => {
    try {
      const res = await apiFetch('/api/connect/data');
      if (res.ok) {
        const data = await res.json();
        setStudentData(data);
        setIsManualMode(false);
        setActiveTab('health');
        setAppState('DATA_READY');
        setStatusDetail('Data ready');
      } else {
        const errData = await res.json().catch(() => ({}));
        setStatusDetail(errData.error || 'Failed to retrieve academic data');
        setAppState('ERROR');
      }
    } catch (err: any) {
      setStatusDetail(err.message || 'Failed to retrieve academic data');
      setAppState('ERROR');
    }
  };

  const handleConnect = async () => {

    setAppState('LAUNCHING');
    setStatusDetail('Starting secure browser session...');
    setStudentData(null);
    setIsManualMode(false);
    
    try {
      const res = await apiFetch('/api/connect', { method: 'POST' });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to start browser session');
      }
      
      const data = await res.json();
      if (data.sessionId) {
        setSessionId(data.sessionId);
      }
      if (data.status) {
        setAppState(data.status);
      }
    } catch (err: any) {
      console.error('Failed to initiate connect:', err);
      if (err.message && err.message.includes('Visible browser authentication')) {
        setShowSyncModal(true);
      }
      
      let errorMsg = err.message || 'Failed to start browser session';
      if (errorMsg.includes('Failed to fetch') || errorMsg.includes('NetworkError')) {
        errorMsg = 'Attendance service is temporarily unavailable. Please try again shortly.';
      }
      
      setStatusDetail(errorMsg);
      setAppState('ERROR');
    }
  };

  const handleDisconnect = async () => {
    setAppState('DISCONNECTING');
    setStatusDetail('Cleaning up session...');
    try {
      await apiFetch('/api/disconnect', { method: 'POST' });
      setAppState('DISCONNECTED');
      setSessionId(null);
      setStudentData(null);
      setStatusDetail(null);
      setIsManualMode(false);
    } catch (err) {
      console.error('Failed to disconnect', err);
      setAppState('DISCONNECTED');
      setSessionId(null);
      setStatusDetail(null);
    }
  };

  const handleUpdateTimetable = (timetable: any) => {
    if (studentData) {
      setStudentData({ ...studentData, timetable });
    }
  };

  const handleManualSave = (subjects: ManualSubject[]) => {
    setManualSubjects(subjects);
    const data = buildManualStudentData(subjects);
    setStudentData(data);
    setIsManualMode(true);
    setShowManualEntry(false);
    setAppState('DATA_READY');
    setActiveTab('health');
  };

  const handleUpdateAcademicData = (academic: { pastSemesters: any[], currentSubjects: any[] }) => {
    if (studentData) {
      const updatedData = { ...studentData, academic };
      setStudentData(updatedData);
    }
  };

  const handleManualEdit = () => {
    setShowManualEntry(true);
  };

  return (
    <div className="container" key={targetRefresh}>
      <TopNav 
        connectionState={appState} 
        onDisconnect={handleDisconnect} 
        activeTab={activeTab} 
        onTabChange={setActiveTab} 
        isManualMode={isManualMode}
        onOpenSettings={() => setShowSettings(true)}
      />

      {/* Settings Modal */}
      {showSettings && (
        <SettingsModal 
          onClose={() => setShowSettings(false)} 
          onSave={() => setTargetRefresh(prev => prev + 1)} 
        />
      )}
      
      {/* 1-Click Portal Sync Modal for Deployed Website */}
      <PortalSyncModal
        isOpen={showSyncModal}
        onClose={() => setShowSyncModal(false)}
        onDataLoaded={(data) => {
          setStudentData(data);
          setAppState('DATA_READY');
          setIsManualMode(false);
          setActiveTab('health');
          setStatusDetail('Attendance synchronized from SRMIST Portal');
        }}
      />

      {/* Manual Entry modal */}
      {showManualEntry && (
        <ManualSubjectEntry
          onSave={handleManualSave}
          onClose={() => setShowManualEntry(false)}
          initialSubjects={manualSubjects}
        />
      )}

      {/* "Edit Subjects" floating button in manual mode */}
      {isManualMode && appState === 'DATA_READY' && (
        <button
          onClick={handleManualEdit}
          style={{ position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: 500, background: 'linear-gradient(135deg, #3b82f6, #6366f1)', border: 'none', color: 'white', padding: '0.75rem 1.25rem', borderRadius: '9999px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600, boxShadow: '0 8px 32px rgba(59,130,246,0.4)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          ✏️ Edit Subjects
        </button>
      )}

      <main className="main-content">
        {/* Welcome / Landing Screen (when completely disconnected or after error) */}
        {(appState === 'DISCONNECTED' || appState === 'ERROR' || appState === 'TIMEOUT') && (
          <div>
            {appState === 'ERROR' && statusDetail && (
              <div style={{ maxWidth: '600px', margin: '1rem auto', padding: '1.25rem', background: 'rgba(239, 68, 68, 0.1)', color: '#f87171', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.2)', textAlign: 'center', fontSize: '0.95rem' }}>
                <p style={{ margin: '0 0 0.75rem 0', fontWeight: 500 }}>{statusDetail}</p>
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => setShowSyncModal(true)}
                    style={{
                      background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
                      color: 'white',
                      border: 'none',
                      padding: '0.5rem 1.25rem',
                      borderRadius: '8px',
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
                    }}
                  >
                    ⚡ Open 1-Click Portal Sync
                  </button>
                  <a
                    href="http://localhost:5173"
                    style={{
                      display: 'inline-block',
                      background: 'rgba(255, 255, 255, 0.1)',
                      color: '#e2e8f0',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      padding: '0.5rem 1.25rem',
                      borderRadius: '8px',
                      fontWeight: 500,
                      fontSize: '0.85rem',
                      textDecoration: 'none',
                    }}
                  >
                    Run Local App (localhost:5173) ↗
                  </a>
                </div>
              </div>
            )}
            {appState === 'TIMEOUT' && (
              <div style={{ maxWidth: '600px', margin: '1rem auto', padding: '1rem', background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', borderRadius: '12px', border: '1px solid rgba(245, 158, 11, 0.2)', textAlign: 'center', fontSize: '0.95rem' }}>
                <strong>Session Timed Out:</strong> Login window remained open without authentication for 10 minutes.
              </div>
            )}
            <LandingPage onStartPlanning={handleManualEdit} onConnect={handleConnect} />
          </div>
        )}

        {appState === 'LAUNCHING' && (
          <div className="empty-state connecting">
            <div className="spinner"></div>
            <h2>Starting secure browser session...</h2>
            <div style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>
              <p>Opening local browser for authentication...</p>
            </div>
          </div>
        )}

        {appState === 'WAITING_FOR_CREDENTIALS' && (
          <CredentialsForm
            sessionId={sessionId!}
            captchaBase64={captchaBase64}
            statusDetail={statusDetail}
            onSuccess={() => {
              setAppState('AUTHENTICATING');
              setStatusDetail('Submitting credentials to SRMIST...');
            }}
            onCancel={handleDisconnect}
          />
        )}

        {(appState === 'WAITING_FOR_LOGIN' || appState === 'AUTHENTICATING' || appState === 'LOGIN_FAILED') && (
          <div className="empty-state connecting">
            <div className="spinner"></div>
            <h2>{appState === 'AUTHENTICATING' ? 'Authenticating with SRMIST...' : 'Waiting for Authentication'}</h2>
            <div style={{ marginTop: '1rem', color: 'var(--text-muted)', maxWidth: '440px', margin: '1rem auto' }}>
              <p style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                SRMIST browser opened — please complete login
              </p>
              <p style={{ marginTop: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Please manually enter your NetID, password, and CAPTCHA in the open browser window.
              </p>
              {appState === 'AUTHENTICATING' && (
                <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                  Verifying credentials and security checks...
                </div>
              )}
              {appState === 'LOGIN_FAILED' && (
                <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                  <strong>Invalid credentials detected.</strong> Please check your NetID, password, or CAPTCHA in the open browser window.
                </div>
              )}
            </div>
          </div>
        )}

        {appState === 'DISCONNECTING' && (
          <div className="empty-state connecting">
            <div className="spinner"></div>
            <h2>Disconnecting...</h2>
            <div style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>
              <p>Cleaning up session safely...</p>
            </div>
          </div>
        )}

        {(appState === 'AUTHENTICATED' || appState === 'EXTRACTING') && (
          <div style={{ padding: '1rem 0' }}>
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
                <span className="spinner" style={{ width: '20px', height: '20px', margin: 0 }}></span> {appState === 'AUTHENTICATED' ? 'Authentication successful' : 'Extracting academic data...'}
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Parsing attendance portal and calculating projections.</p>
            </div>
            
            {/* Skeleton Dashboard Layout */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
              <div className="skeleton-box" style={{ height: '200px', borderRadius: '16px' }}></div>
              <div className="skeleton-box" style={{ height: '200px', borderRadius: '16px' }}></div>
              <div className="skeleton-box" style={{ height: '200px', borderRadius: '16px' }}></div>
            </div>
            
            <div className="skeleton-box" style={{ height: '300px', borderRadius: '16px' }}></div>
          </div>
        )}

        {appState === 'DATA_READY' && studentData && (
          <div>
            {/* Manual mode header banner */}
            {isManualMode && (
              <div style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: '8px', padding: '0.75rem 1.25rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                <span style={{ color: 'rgba(255,255,255,0.7)' }}>✏️ <strong style={{ color: '#60a5fa' }}>Manual Entry Mode</strong> — Showing locally entered subjects. Portal data is not connected.</span>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button onClick={handleManualEdit} style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', color: '#60a5fa', padding: '0.35rem 0.9rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500 }}>✏️ Edit Subjects</button>
                  <button onClick={handleConnect} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', padding: '0.35rem 0.9rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}>🔗 Connect to Portal</button>
                </div>
              </div>
            )}
            <Dashboard 
              studentData={studentData} 
              onUpdateTimetable={handleUpdateTimetable} 
              onUpdateAcademicData={handleUpdateAcademicData}
              activeTab={activeTab} 
              onTabChange={setActiveTab}
            />
          </div>
        )}
      </main>

      <BottomNav 
        activeTab={activeTab} 
        onTabChange={setActiveTab} 
        show={appState === 'DATA_READY' && !!studentData} 
      />

      {/* PWA Install Prompt — auto-triggers on Android/Chrome */}
      <PwaInstallPrompt />
    </div>
  );
}

export default App;
