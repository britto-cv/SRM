import React, { useEffect, useState } from 'react';

interface LandingPageProps {
  onStartPlanning: () => void;
  onConnect: () => void;
  onOpenSync?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onStartPlanning, onConnect, onOpenSync }) => {
  const [mounted, setMounted] = useState(false);
  
  // Mockup Interactive State
  const [dsMisses, setDsMisses] = useState(0);
  const [mlMisses, setMlMisses] = useState(0);
  const [dmMisses, setDmMisses] = useState(0);

  const dsConducted = 50 + dsMisses;
  const dsPct = (40 / dsConducted) * 100;
  
  const mlConducted = 45 + mlMisses;
  const mlPct = (34 / mlConducted) * 100;

  const dmConducted = 31 + dmMisses;
  const dmPct = (22 / dmConducted) * 100;

  const totalAttended = 40 + 34 + 22;
  const totalConducted = dsConducted + mlConducted + dmConducted;
  const overallPct = (totalAttended / totalConducted) * 100;
  
  const [displayPct, setDisplayPct] = useState(0);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    // Initial mount animation
    const timer = setTimeout(() => {
      setMounted(true);
      setAnimating(true);
      const duration = 1200;
      const startTime = performance.now();
      
      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 3);
        setDisplayPct((totalAttended / 126) * 100 * ease);
        if (progress < 1) requestAnimationFrame(animate);
        else {
          setDisplayPct((totalAttended / 126) * 100);
          setAnimating(false);
        }
      };
      requestAnimationFrame(animate);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Sync display percentage when overallPct changes (after initial load)
  useEffect(() => {
    if (mounted && !animating) {
      setDisplayPct(overallPct);
    }
  }, [overallPct, mounted, animating]);
  
  useEffect(() => {
    // Slight delay to trigger enter animations
    const timer = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      minHeight: '100%',
      width: '100%',
      padding: '2rem 1rem',
      overflowX: 'hidden',
      position: 'relative'
    }}>
      {/* Transparent Logo Watermark */}
      <img
        src="/logo.png"
        alt=""
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '320px',
          height: '320px',
          objectFit: 'contain',
          opacity: 0.04,
          pointerEvents: 'none',
          userSelect: 'none',
          zIndex: 0
        }}
      />
      
      {/* Container for max width and desktop grid */}
      <div style={{
        maxWidth: '1200px',
        width: '100%',
        margin: '0 auto',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 450px), 1fr))',
        gap: '4rem',
        alignItems: 'center',
        paddingTop: '2rem',
        position: 'relative',
        zIndex: 1
      }}>
        
        {/* Left Column: Copy & CTAs */}
        <div 
          className="hero-copy"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem',
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateY(0)' : 'translateY(20px)',
            transition: 'opacity 0.6s cubic-bezier(0.2, 0.8, 0.2, 1), transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1)'
          }}
        >
          <h1 style={{
            fontSize: 'clamp(2.5rem, 5vw + 1rem, 4rem)',
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
            background: 'linear-gradient(135deg, #ffffff 0%, #a5b4fc 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            margin: 0
          }}>
            Bunk Pannalama?<br/>
            First Calculate Pannu.
          </h1>
          
          <p style={{
            fontSize: 'clamp(1rem, 2vw, 1.15rem)',
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
            maxWidth: '90%'
          }}>
            Attendance evlo irukku, ethana class miss pannalaam, enga recovery venum-nu Bunk Adkirow unakku clear-ah sollum.
          </p>

          <p style={{
            fontSize: '0.9rem',
            fontWeight: 600,
            color: 'var(--primary)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginTop: '-0.5rem'
          }}>
            Guess panna vendam. Calculate panni bunk pannu.
          </p>

          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.75rem',
            marginTop: '1rem'
          }}>
            <button 
              onClick={onConnect}
              style={{
                background: 'var(--primary)',
                color: 'white',
                border: 'none',
                padding: '0.85rem 1.75rem',
                borderRadius: '8px',
                fontSize: '0.95rem',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 4px 14px 0 rgba(59, 130, 246, 0.39)',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(59, 130, 246, 0.23)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 14px 0 rgba(59, 130, 246, 0.39)';
              }}
            >
              Check My Attendance
            </button>
            {onOpenSync && (
              <button 
                onClick={onOpenSync}
                style={{
                  background: 'rgba(59, 130, 246, 0.1)',
                  color: '#60a5fa',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  padding: '0.85rem 1.5rem',
                  borderRadius: '8px',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  transition: 'background 0.2s ease, border-color 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(59, 130, 246, 0.2)';
                  e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)';
                  e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.3)';
                }}
              >
                ⚡ 1-Click Portal Sync
              </button>
            )}
            <button 
              onClick={onStartPlanning}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                color: 'var(--text-muted)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                padding: '0.85rem 1.5rem',
                borderRadius: '8px',
                fontSize: '0.95rem',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'background 0.2s ease, border-color 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
              }}
            >
              Manual Mode
            </button>
          </div>
        </div>

        {/* Right Column: Dashboard Mockup */}
        <div 
          className="hero-mockup"
          style={{
            position: 'relative',
            width: '100%',
            display: 'flex',
            justifyContent: 'center',
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateY(0) scale(1)' : 'translateY(30px) scale(0.98)',
            transition: 'opacity 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) 0.1s, transform 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) 0.1s'
          }}
        >
          {/* Subtle Glow behind mockup */}
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '80%',
            height: '80%',
            background: 'var(--primary)',
            filter: 'blur(100px)',
            opacity: 0.15,
            borderRadius: '50%',
            zIndex: 0
          }} />

          {/* The Mockup Card */}
          <div style={{
            position: 'relative',
            zIndex: 1,
            width: '100%',
            maxWidth: '500px',
            background: 'var(--surface-glass)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            padding: '1.5rem',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem'
          }}>
            
            {/* Mockup Header: Overall Gauge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
              <div style={{ position: 'relative', width: '100px', height: '100px' }}>
                <svg width="100" height="100" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
                  {/* Background track */}
                  <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
                  {/* Target line indicator */}
                  <circle cx="50" cy="50" r="45" fill="none" stroke="var(--border)" strokeWidth="8" strokeDasharray="1 281" strokeDashoffset="-212" />
                  {/* Progress bar */}
                  <circle 
                    cx="50" cy="50" r="45" fill="none" 
                    stroke={displayPct >= 75 ? 'var(--status-safe)' : displayPct >= 70 ? 'var(--status-watch)' : 'var(--status-risk)'} 
                    strokeWidth="8" 
                    strokeDasharray="282.74" 
                    strokeDashoffset={282.74 - (282.74 * displayPct) / 100}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 0.5s ease-out, stroke 0.5s ease' }}
                  />
                </svg>
                <div style={{
                  position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
                }}>
                  <span style={{ fontSize: '1.25rem', fontWeight: 800, color: displayPct >= 75 ? 'var(--status-safe)' : displayPct >= 70 ? 'var(--status-watch)' : 'var(--status-risk)', lineHeight: 1, transition: 'color 0.5s ease' }}>
                    {displayPct.toFixed(1)}%
                  </span>
                  <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>Target: 75%</span>
                </div>
              </div>
              
              <div>
                <h3 style={{ fontSize: '1.1rem', margin: '0 0 0.5rem 0', fontWeight: 600 }}>Overall Health</h3>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <span className={`pill ${overallPct >= 75 ? 'pill-safe' : 'pill-unavailable'}`}>
                    {overallPct >= 75 ? '1 SAFE' : '0 SAFE'}
                  </span>
                  <span className={`pill ${overallPct >= 70 && overallPct < 75 ? 'pill-watch' : 'pill-unavailable'}`}>
                    {overallPct >= 70 && overallPct < 75 ? '1 WATCH' : '0 WATCH'}
                  </span>
                  <span className={`pill ${overallPct < 70 ? 'pill-risk' : 'pill-unavailable'}`}>
                    {overallPct < 70 ? '1 RISK' : '0 RISK'}
                  </span>
                </div>
              </div>
            </div>

            {/* Mockup Body: Subject rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              
              {/* Row 1: Safe */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px'
              }}>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>Data Structures</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', transition: 'color 0.3s' }}>
                    <span style={{ color: dsPct >= 75 ? 'var(--status-safe)' : dsPct >= 70 ? 'var(--status-watch)' : 'var(--status-risk)' }}>{dsPct.toFixed(1)}%</span> • 40/{dsConducted} hrs
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <div style={{ textAlign: 'right', fontSize: '0.75rem', color: dsPct >= 75 ? 'var(--status-safe)' : 'var(--text-muted)' }}>
                    {dsPct >= 75 ? `+${Math.floor(40/0.75) - dsConducted} safe misses` : '0 safe misses'}
                  </div>
                  <button 
                    onClick={() => setDsMisses(m => m + 1)}
                    title="Simulate Bunk"
                    style={{ background: 'rgba(239,68,68,0.1)', border: 'none', color: 'var(--status-risk)', width: '28px', height: '28px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
                  >
                    +1
                  </button>
                </div>
              </div>

              {/* Row 2: Watch */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px'
              }}>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>Machine Learning</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', transition: 'color 0.3s' }}>
                    <span style={{ color: mlPct >= 75 ? 'var(--status-safe)' : mlPct >= 70 ? 'var(--status-watch)' : 'var(--status-risk)' }}>{mlPct.toFixed(1)}%</span> • 34/{mlConducted} hrs
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <div style={{ textAlign: 'right', fontSize: '0.75rem', color: mlPct >= 70 && mlPct < 75 ? 'var(--status-watch)' : 'var(--text-muted)' }}>
                    {mlPct >= 75 ? `+${Math.floor(34/0.75) - mlConducted} safe misses` : mlPct >= 70 ? '0 safe misses' : `Attend ${Math.ceil(0.75 * mlConducted - 34)} classes`}
                  </div>
                  <button 
                    onClick={() => setMlMisses(m => m + 1)}
                    title="Simulate Bunk"
                    style={{ background: 'rgba(239,68,68,0.1)', border: 'none', color: 'var(--status-risk)', width: '28px', height: '28px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
                  >
                    +1
                  </button>
                </div>
              </div>

              {/* Row 3: Risk */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px'
              }}>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>Discrete Maths</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', transition: 'color 0.3s' }}>
                    <span style={{ color: dmPct >= 75 ? 'var(--status-safe)' : dmPct >= 70 ? 'var(--status-watch)' : 'var(--status-risk)' }}>{dmPct.toFixed(1)}%</span> • 22/{dmConducted} hrs
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <div style={{ textAlign: 'right', fontSize: '0.75rem', color: dmPct < 70 ? 'var(--status-risk)' : 'var(--text-muted)' }}>
                    {dmPct >= 75 ? `+${Math.floor(22/0.75) - dmConducted} safe misses` : dmPct >= 70 ? '0 safe misses' : `Attend ${Math.ceil((0.75 * dmConducted - 22) / 0.25)} to hit 75%`}
                  </div>
                  <button 
                    onClick={() => setDmMisses(m => m + 1)}
                    title="Simulate Bunk"
                    style={{ background: 'rgba(239,68,68,0.1)', border: 'none', color: 'var(--status-risk)', width: '28px', height: '28px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
                  >
                    +1
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
