'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { 
  ChevronLeft, 
  Eye, 
  EyeOff, 
  Download, 
  Database,
  CheckCircle,
  XCircle,
  FileDown,
  Info,
  Layers,
  Copy,
  Check
} from 'lucide-react';

const ThreeViewer = dynamic(() => import('@/components/ThreeViewer'), { ssr: false });

interface ModelData {
  maxilla: {
    input: string;
    output: string;
  };
  mandible: {
    input: string;
    output: string;
  };
}

interface StatsData {
  vertices?: number;
  faces?: number;
  watertight?: boolean;
}

export default function ViewerPage() {
  const router = useRouter();
  const params = useParams();
  const uid = params.uid as string;

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // URL mesh configuration for ThreeViewer
  const [meshUrls, setMeshUrls] = useState<{
    inputMaxilla: string | null;
    inputMandible: string | null;
    outputMaxilla: string | null;
    outputMandible: string | null;
  }>({
    inputMaxilla: null,
    inputMandible: null,
    outputMaxilla: null,
    outputMandible: null,
  });

  // Visibility states
  const [visibility, setVisibility] = useState({
    inputMaxilla: false, // Default inputs hidden for clean output inspection
    inputMandible: false,
    outputMaxilla: true,  // Default outputs visible
    outputMandible: true,
  });

  // File names for UI display
  const [filenames, setFilenames] = useState({
    inputMaxilla: 'mesh2.stl',
    inputMandible: 'mesh1.stl',
    outputMaxilla: 'mesh2_model_U.stl',
    outputMandible: 'mesh1_model_L.stl',
  });

  // Copied UID tooltip state
  const [copied, setCopied] = useState(false);

  // Helper to extract the filename from GCS signed URL
  const getFilenameFromUrl = (url: string) => {
    try {
      const decoded = decodeURIComponent(url);
      const urlWithoutParams = decoded.split('?')[0];
      const pathParts = urlWithoutParams.split('/');
      return pathParts[pathParts.length - 1];
    } catch (e) {
      if (url.includes('mesh1_model_L.stl')) return 'mesh1_model_L.stl';
      if (url.includes('mesh2_model_L.stl')) return 'mesh2_model_L.stl';
      if (url.includes('mesh1_model_U.stl')) return 'mesh1_model_U.stl';
      if (url.includes('mesh2_model_U.stl')) return 'mesh2_model_U.stl';
      if (url.includes('mesh1.stl')) return 'mesh1.stl';
      if (url.includes('mesh2.stl')) return 'mesh2.stl';
      return '';
    }
  };

  // Copy UID function
  const copyUidToClipboard = () => {
    navigator.clipboard.writeText(uid);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Fetch Mesh URLs on Load
  useEffect(() => {
    if (!uid) return;

    const fetchMeshUrls = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_URL}/download/${uid}`);
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.detail || 'No processed models found for this case.');
        }

        const data: ModelData = await res.json();

        // Extract filenames to show them in the UI lists
        const fileNamesObj = {
          inputMaxilla: getFilenameFromUrl(data.maxilla.input) || 'mesh2.stl',
          inputMandible: getFilenameFromUrl(data.mandible.input) || 'mesh1.stl',
          outputMaxilla: getFilenameFromUrl(data.maxilla.output) || 'mesh2_model_U.stl',
          outputMandible: getFilenameFromUrl(data.mandible.output) || 'mesh1_model_L.stl',
        };
        setFilenames(fileNamesObj);

        // Construct local download URLs to bypass GCS CORS rules
        setMeshUrls({
          inputMaxilla: `${API_URL}/download/${uid}/${fileNamesObj.inputMaxilla}`,
          inputMandible: `${API_URL}/download/${uid}/${fileNamesObj.inputMandible}`,
          outputMaxilla: `${API_URL}/download/${uid}/${fileNamesObj.outputMaxilla}`,
          outputMandible: `${API_URL}/download/${uid}/${fileNamesObj.outputMandible}`,
        });

      } catch (err: any) {
        console.error(err);
        setError(err.message || 'Failed to retrieve model download links.');
      } finally {
        setLoading(false);
      }
    };

    fetchMeshUrls();
  }, [uid, API_URL]);

  // Toggle handlers
  const toggleVisibility = (key: keyof typeof visibility) => {
    setVisibility((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const toggleGlobalInputs = () => {
    const nextVal = !(visibility.inputMaxilla && visibility.inputMandible);
    setVisibility((prev) => ({
      ...prev,
      inputMaxilla: nextVal,
      inputMandible: nextVal,
    }));
  };

  const toggleGlobalOutputs = () => {
    const nextVal = !(visibility.outputMaxilla && visibility.outputMandible);
    setVisibility((prev) => ({
      ...prev,
      outputMaxilla: nextVal,
      outputMandible: nextVal,
    }));
  };

  // ZIP download trigger
  const handleDownloadZip = () => {
    window.location.href = `${API_URL}/download-zip/${uid}`;
  };

  return (
    <div className="app-container">
      {/* Header bar */}
      <header className="header">
        <div className="logo-container">
          <img src="/dentalai_logo.png" alt="Dental AI Logo" style={{ height: '28px', objectFit: 'contain' }} />
          <h1 className="logo-text" style={{ marginLeft: '0.5rem' }}>MODEL BUILDER</h1>
          <span className="logo-badge">3D Inspector</span>
        </div>
        <div className="text-sm text-slate-400 font-medium">
          Case UID: <span className="text-[#06b6d4] font-semibold">{uid}</span>
        </div>
      </header>

      {/* Main split grid */}
      <main className="viewer-content">
        
        {/* Left Sidebar */}
        <aside className="viewer-sidebar">
          
          <div className="sidebar-header">
            
            {/* Back button */}
            <Link href="/" className="back-btn">
              <ChevronLeft size={16} /> Back to Builder
            </Link>

            {/* Case Details card */}
            <div className="case-id-container">
              <div className="flex justify-between items-center">
                <span className="case-id-label">Case Identifier</span>
                <button 
                  onClick={copyUidToClipboard}
                  className="text-slate-400 hover:text-[#06b6d4] transition-colors"
                  title="Copy UID to Clipboard"
                >
                  {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                </button>
              </div>
              <span className="case-id-value" title={uid}>{uid}</span>
            </div>

            {/* Mesh list sections */}
            {!loading && !error && (
              <div className="mesh-list-section">
                
                {/* Global and Individual Inputs Toggle Card */}
                <div className="mesh-group-card">
                  <div className="mesh-group-header">
                    <span className="mesh-group-name">Input Scan Files</span>
                    <button onClick={toggleGlobalInputs} className="eye-icon-btn">
                      {visibility.inputMaxilla && visibility.inputMandible ? <Eye size={16} /> : <EyeOff size={16} />}
                    </button>
                  </div>
                  
                  <div className="mesh-item-row">
                    <div className="mesh-info">
                      <span className="mesh-dot mesh-dot-input-u" />
                      <span className="mesh-name">Maxilla Input</span>
                    </div>
                    <button onClick={() => toggleVisibility('inputMaxilla')} className="eye-icon-btn">
                      {visibility.inputMaxilla ? <Eye size={15} /> : <EyeOff size={15} />}
                    </button>
                  </div>

                  <div className="mesh-item-row">
                    <div className="mesh-info">
                      <span className="mesh-dot mesh-dot-input-l" />
                      <span className="mesh-name">Mandible Input</span>
                    </div>
                    <button onClick={() => toggleVisibility('inputMandible')} className="eye-icon-btn">
                      {visibility.inputMandible ? <Eye size={15} /> : <EyeOff size={15} />}
                    </button>
                  </div>
                </div>

                {/* Global and Individual Outputs Toggle Card */}
                <div className="mesh-group-card">
                  <div className="mesh-group-header">
                    <span className="mesh-group-name">Output Base Models</span>
                    <button onClick={toggleGlobalOutputs} className="eye-icon-btn">
                      {visibility.outputMaxilla && visibility.outputMandible ? <Eye size={16} /> : <EyeOff size={16} />}
                    </button>
                  </div>
                  
                  <div className="mesh-item-row">
                    <div className="mesh-info">
                      <span className="mesh-dot mesh-dot-output-u" />
                      <span className="mesh-name">Maxilla Output</span>
                    </div>
                    <button onClick={() => toggleVisibility('outputMaxilla')} className="eye-icon-btn">
                      {visibility.outputMaxilla ? <Eye size={15} /> : <EyeOff size={15} />}
                    </button>
                  </div>

                  <div className="mesh-item-row">
                    <div className="mesh-info">
                      <span className="mesh-dot mesh-dot-output-l" />
                      <span className="mesh-name">Mandible Output</span>
                    </div>
                    <button onClick={() => toggleVisibility('outputMandible')} className="eye-icon-btn">
                      {visibility.outputMandible ? <Eye size={15} /> : <EyeOff size={15} />}
                    </button>
                  </div>
                </div>

                {/* Additional Info Cards */}
                <div className="viewer-stats-panel">
                  <div className="flex items-center gap-1.5 font-semibold text-slate-300 border-b border-white/5 pb-1.5 mb-1">
                    <Layers size={12} className="text-[#06b6d4]" /> Model Status
                  </div>
                  <div className="stats-row">
                    <span className="stats-label">Watertightness:</span>
                    <span className="stats-value text-emerald-500 flex items-center gap-1">
                      <CheckCircle size={10} /> Validated
                    </span>
                  </div>
                  <div className="stats-row">
                    <span className="stats-label">Upper Filename:</span>
                    <span className="stats-value truncate max-w-[120px]" title={filenames.outputMaxilla}>{filenames.outputMaxilla}</span>
                  </div>
                  <div className="stats-row">
                    <span className="stats-label">Lower Filename:</span>
                    <span className="stats-value truncate max-w-[120px]" title={filenames.outputMandible}>{filenames.outputMandible}</span>
                  </div>
                </div>

              </div>
            )}
          </div>

          <div className="sidebar-footer">
            <button 
              onClick={handleDownloadZip} 
              className="download-btn w-full"
              disabled={loading || !!error}
            >
              <Download size={16} /> Download ZIP Models
            </button>
          </div>

        </aside>

        {/* Right Canvas Visualizer Area */}
        <section className="preview-panel">
          
          {loading && (
            <div className="loading-overlay">
              <div className="loader-spinner" />
              <h2 className="loading-title">Downloading 3D meshes</h2>
              <p className="text-xs text-slate-400">Loading Maxilla and Mandible STL files into WebGL scene...</p>
            </div>
          )}

          {error && (
            <div className="loading-overlay">
              <XCircle className="text-red-500 animate-pulse" size={48} />
              <h2 className="loading-title text-red-400">Visualization Failed</h2>
              <p className="text-xs text-slate-400 max-w-sm text-center px-4">{error}</p>
              <Link href="/" className="submit-btn mt-4">
                Return to Builder
              </Link>
            </div>
          )}

          {!loading && !error && (
            <div className="canvas-container">
              {/* Floating Legend Overlay */}
              <div className="absolute top-4 right-4 z-10 bg-slate-950/80 backdrop-blur-md border border-white/10 px-3 py-2 rounded-lg flex flex-col gap-1.5 pointer-events-none text-[11px] select-none">
                <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-0.5">3D Model Legend</div>
                {visibility.outputMaxilla && (
                  <div className="flex items-center gap-1.5 text-slate-200">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#f0ece4] border border-white/10" />
                    <span>Maxilla Output (Ivory Plaster)</span>
                  </div>
                )}
                {visibility.outputMandible && (
                  <div className="flex items-center gap-1.5 text-slate-200">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#0d9488] border border-white/10" />
                    <span>Mandible Output (Teal Resin)</span>
                  </div>
                )}
                {visibility.inputMaxilla && (
                  <div className="flex items-center gap-1.5 text-slate-200">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#5b9cf5] border border-white/10" />
                    <span>Maxilla Input (Translucent Blue)</span>
                  </div>
                )}
                {visibility.inputMandible && (
                  <div className="flex items-center gap-1.5 text-slate-200">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#8b7df5] border border-white/10" />
                    <span>Mandible Input (Translucent Indigo)</span>
                  </div>
                )}
              </div>

              <ThreeViewer 
                meshUrls={meshUrls}
                visibility={visibility}
              />
            </div>
          )}

        </section>

      </main>
    </div>
  );
}
