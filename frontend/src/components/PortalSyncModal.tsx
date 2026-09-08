import React, { useState } from 'react';
import type { NormalizedStudentData } from '@srm/shared';

interface PortalSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataLoaded: (data: NormalizedStudentData) => void;
}

export const PortalSyncModal: React.FC<PortalSyncModalProps> = ({ isOpen, onClose, onDataLoaded }) => {
  const [activeTab, setActiveTab] = useState<'bookmarklet' | 'paste'>('bookmarklet');
  const [pastedHtml, setPastedHtml] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const bookmarkletCode = `javascript:(function(){try{const rows=document.querySelectorAll('table.table tbody tr, table tbody tr');const subjects=[];const attendance=[];rows.forEach(r=>{const c=r.querySelectorAll('td');if(c.length>=6){const code=c[0]?.innerText?.trim()||'';const name=c[1]?.innerText?.trim()||'';const maxH=parseInt(c[2]?.innerText?.trim()||'0',10);const attH=parseInt(c[3]?.innerText?.trim()||'0',10);if(code&&!code.toLowerCase().includes('total')&&!code.includes('/')&&!isNaN(maxH)&&maxH>0){subjects.push({code,name,credits:3});attendance.push({subjectCode:code,conductedHours:maxH,attendedHours:attH,percentage:(attH/maxH)*100});}}});if(subjects.length===0){alert('Please make sure you are on the Attendance Details page of SRMIST Student Portal!');return;}const data={profile:{name:'SRM Student',studentId:'Portal Sync',program:'B.Tech',department:'SRMIST'},currentSemester:{id:'current',name:'Current Semester'},subjects,attendance};window.open('https://srm-students-portal.vercel.app/#srm_data='+encodeURIComponent(JSON.stringify(data)),'_blank');}catch(e){alert('Sync error: '+e.message);}})();`;

  const handleParsePasted = () => {
    try {
      setError(null);
      const parser = new DOMParser();
      const doc = parser.parseFromString(pastedHtml, 'text/html');
      const rows = doc.querySelectorAll('table.table tbody tr, table tbody tr, tr');
      const subjects: any[] = [];
      const attendance: any[] = [];

      rows.forEach(r => {
        const c = r.querySelectorAll('td');
        if (c.length >= 6) {
          const code = c[0]?.textContent?.trim() || '';
          const name = c[1]?.textContent?.trim() || '';
          const maxH = parseInt(c[2]?.textContent?.trim() || '0', 10);
          const attH = parseInt(c[3]?.textContent?.trim() || '0', 10);
          if (code && !code.toLowerCase().includes('total') && !code.includes('/') && !isNaN(maxH) && maxH > 0) {
            subjects.push({ code, name, credits: 3 });
            attendance.push({
              subjectCode: code,
              conductedHours: maxH,
              attendedHours: attH,
              percentage: (attH / maxH) * 100,
            });
          }
        }
      });

      if (subjects.length === 0) {
        throw new Error('No attendance rows found in pasted text. Make sure you copied the Attendance Details table.');
      }

      const normalized: NormalizedStudentData = {
        profile: { name: 'SRM Student', studentId: 'Manual Sync', program: 'B.Tech', department: 'SRMIST' },
        currentSemester: { id: 'current', name: 'Current Semester' },
        subjects,
        attendance,
      };

      onDataLoaded(normalized);
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to parse attendance data');
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      background: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      padding: '1rem',
    }}>
      <div style={{
        background: '#0f172a',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '540px',
        padding: '2rem',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        color: '#f8fafc',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700 }}>Connect SRMIST Portal</h2>
            <p style={{ margin: '0.25rem 0 0 0', color: '#94a3b8', fontSize: '0.85rem' }}>
              Sync your live attendance directly from the portal
            </p>
          </div>
          <button 
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: '1.5rem',
              cursor: 'pointer',
              padding: '0.25rem 0.5rem',
            }}
          >
            ×
          </button>
        </div>

        {/* Tab switcher */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', background: 'rgba(255, 255, 255, 0.05)', padding: '0.25rem', borderRadius: '8px' }}>
          <button
            onClick={() => setActiveTab('bookmarklet')}
            style={{
              flex: 1,
              padding: '0.6rem',
              borderRadius: '6px',
              border: 'none',
              background: activeTab === 'bookmarklet' ? '#3b82f6' : 'transparent',
              color: 'white',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
          >
            ⚡ 1-Click Sync Bookmark
          </button>
          <button
            onClick={() => setActiveTab('paste')}
            style={{
              flex: 1,
              padding: '0.6rem',
              borderRadius: '6px',
              border: 'none',
              background: activeTab === 'paste' ? '#3b82f6' : 'transparent',
              color: 'white',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
          >
            📋 Paste Portal Table
          </button>
        </div>

        {/* Tab 1: Bookmarklet */}
        {activeTab === 'bookmarklet' && (
          <div>
            <div style={{
              background: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.2)',
              borderRadius: '12px',
              padding: '1.25rem',
              textAlign: 'center',
              marginBottom: '1.5rem',
            }}>
              <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.85rem', color: '#94a3b8' }}>
                👉 <strong>Drag this button to your Bookmarks bar:</strong>
              </p>
              <a
                href={bookmarkletCode}
                onClick={(e) => {
                  e.preventDefault();
                  alert('Drag this button to your browser bookmarks bar (or bookmark it), then click it while on the SRM Attendance page!');
                }}
                style={{
                  display: 'inline-block',
                  background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
                  color: 'white',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '9999px',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  textDecoration: 'none',
                  boxShadow: '0 4px 14px rgba(59, 130, 246, 0.4)',
                  cursor: 'grab',
                }}
              >
                📌 Sync to Bunk Adkirow
              </a>
            </div>

            <ol style={{ paddingLeft: '1.25rem', margin: '0 0 1.5rem 0', fontSize: '0.85rem', color: '#cbd5e1', lineHeight: '1.8' }}>
              <li>Log into the <a href="https://sp.srmist.edu.in/srmiststudentportal/students/loginManager/youLogin.jsp" target="_blank" rel="noreferrer" style={{ color: '#60a5fa' }}>SRMIST Student Portal ↗</a> in your browser.</li>
              <li>Navigate to your <strong>Attendance Details</strong> page.</li>
              <li>Click your <strong>"Sync to Bunk Adkirow"</strong> bookmark.</li>
              <li>Your live attendance opens right here in Bunk Adkirow!</li>
            </ol>
          </div>
        )}

        {/* Tab 2: Paste HTML */}
        {activeTab === 'paste' && (
          <div>
            <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: '#94a3b8' }}>
              Copy the attendance table from the SRM portal (or press Ctrl+A / Cmd+A on the attendance page) and paste it below:
            </p>
            <textarea
              value={pastedHtml}
              onChange={(e) => setPastedHtml(e.target.value)}
              placeholder="Paste attendance HTML or table text here..."
              rows={6}
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: 'white',
                fontSize: '0.85rem',
                fontFamily: 'monospace',
                resize: 'vertical',
                marginBottom: '1rem',
              }}
            />
            {error && (
              <div style={{ color: '#ef4444', fontSize: '0.85rem', marginBottom: '1rem' }}>
                ⚠️ {error}
              </div>
            )}
            <button
              onClick={handleParsePasted}
              disabled={!pastedHtml.trim()}
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '8px',
                background: pastedHtml.trim() ? '#3b82f6' : 'rgba(255, 255, 255, 0.1)',
                color: 'white',
                fontWeight: 600,
                border: 'none',
                cursor: pastedHtml.trim() ? 'pointer' : 'not-allowed',
              }}
            >
              Parse & Open Dashboard
            </button>
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: '1rem' }}>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#64748b',
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
