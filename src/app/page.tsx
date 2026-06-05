'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { 
  Upload, 
  FileCode, 
  Trash2, 
  Sliders, 
  Activity, 
  Sparkles, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  HelpCircle,
  Eye,
  EyeOff
} from 'lucide-react';

// Dynamically import the client-side ThreeViewer to prevent SSR issues
const ThreeViewer = dynamic(() => import('@/components/ThreeViewer'), { ssr: false });

export default function Home() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form states
  const [files, setFiles] = useState<File[]>([]);
  const [archType, setArchType] = useState<'full' | 'premolar' | 'anterior' | 'custom'>('full');
  
  // FDI custom range states
  const [fdiUpperStart, setFdiUpperStart] = useState<string>('13');
  const [fdiUpperEnd, setFdiUpperEnd] = useState<string>('23');
  const [fdiLowerStart, setFdiLowerStart] = useState<string>('43');
  const [fdiLowerEnd, setFdiLowerEnd] = useState<string>('33');

  const [baseType, setBaseType] = useState<'solid' | 'hollow' | 'honeycomb'>('solid');
  const [palate, setPalate] = useState<boolean>(false);
  const [drainHoles, setDrainHoles] = useState<boolean>(false);
  const [baseHeight, setBaseHeight] = useState<number>(3.0);
  const [shellThickness, setShellThickness] = useState<number>(1.0);
  
  const [labelTextOption, setLabelTextOption] = useState<'filename' | 'custom' | 'none'>('filename');
  const [customLabelText, setCustomLabelText] = useState<string>('Filename');

  // Interactive UI States
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStep, setSubmitStep] = useState<number>(0); // 0: idle, 1: uploading, 2: building, 3: rendering
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // File metadata for sizes/vertices
  const [fileMetadata, setFileMetadata] = useState<Record<string, { vertices: number }>>({});

  // Local preview meshes visibility
  const [previewVisibility, setPreviewVisibility] = useState({
    mesh1: true,
    mesh2: true,
  });

  // API base URL
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

  // Automatically parse files to extract vertex count
  useEffect(() => {
    const parseFiles = async () => {
      try {
        const { STLLoader } = await import('three/examples/jsm/loaders/STLLoader.js');
        const loader = new STLLoader();

        files.forEach((file) => {
          if (fileMetadata[file.name]) return;

          const reader = new FileReader();
          reader.onload = (e) => {
            if (e.target?.result) {
              try {
                const buffer = e.target.result as ArrayBuffer;
                const geom = loader.parse(buffer);
                const count = geom.attributes.position ? geom.attributes.position.count : 0;
                setFileMetadata((prev) => ({
                  ...prev,
                  [file.name]: { vertices: count }
                }));
                geom.dispose();
              } catch (err) {
                console.error("Failed to parse STL geometry:", err);
              }
            }
          };
          reader.readAsArrayBuffer(file);
        });
      } catch (err) {
        console.error("Failed to dynamically import STLLoader:", err);
      }
    };

    if (files.length > 0) {
      parseFiles();
    }
  }, [files, fileMetadata]);

  // Watchers to disable invalid combinations automatically
  useEffect(() => {
    // Palate is workable only when 'full' is chosen, else locked to false
    if (archType !== 'full') {
      setPalate(false);
    }
  }, [archType]);

  useEffect(() => {
    // Drain holes workable only when base type is hollow or honeycomb, else locked to false
    if (baseType === 'solid') {
      setDrainHoles(false);
    }
  }, [baseType]);

  // Elapsed timer during pipeline processing
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isSubmitting && submitStep === 2) {
      timer = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);
    } else {
      setElapsedTime(0);
    }
    return () => clearInterval(timer);
  }, [isSubmitting, submitStep]);

  // Tooth selection arrays for FDI range selector
  // Quadrant 1 (Right) & Quadrant 2 (Left) for Upper Maxilla
  const fdiUpperTeeth = [
    '18', '17', '16', '15', '14', '13', '12', '11',
    '21', '22', '23', '24', '25', '26', '27', '28'
  ];
  // Quadrant 4 (Right) & Quadrant 3 (Left) for Lower Mandible
  const fdiLowerTeeth = [
    '48', '47', '46', '45', '44', '43', '42', '41',
    '31', '32', '33', '34', '35', '36', '37', '38'
  ];

  // Drag & Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  // Helper to extract files from DataTransferItems, including folders recursively
  const traverseFileTree = (item: any): Promise<File[]> => {
    return new Promise((resolve) => {
      try {
        if (!item) {
          resolve([]);
          return;
        }
        if (item.isFile) {
          item.file(
            (file: File) => {
              if (file && file.name.toLowerCase().endsWith('.stl')) {
                resolve([file]);
              } else {
                resolve([]);
              }
            },
            (err: any) => {
              console.error("Error reading file entry:", err);
              resolve([]);
            }
          );
        } else if (item.isDirectory) {
          const dirReader = item.createReader();
          const readEntries = () => {
            dirReader.readEntries(
              async (entries: any[]) => {
                if (!entries || entries.length === 0) {
                  resolve([]);
                  return;
                }
                try {
                  const filePromises = entries.map((entry) => traverseFileTree(entry));
                  const filesArrays = await Promise.all(filePromises);
                  resolve(filesArrays.flat());
                } catch (err) {
                  console.error("Error reading sub-entries:", err);
                  resolve([]);
                }
              },
              (err: any) => {
                console.error("Error reading directory entries:", err);
                resolve([]);
              }
            );
          };
          readEntries();
        } else {
          resolve([]);
        }
      } catch (e) {
        console.error("Exception inside traverseFileTree:", e);
        resolve([]);
      }
    });
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    setErrorMessage(null);

    const items = e.dataTransfer.items;
    const droppedFiles: File[] = [];

    try {
      if (items && items.length > 0) {
        const promises: Promise<File[]>[] = [];
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (item.kind === 'file') {
            if (typeof item.webkitGetAsEntry === 'function') {
              const entry = item.webkitGetAsEntry();
              if (entry) {
                promises.push(traverseFileTree(entry));
              }
            } else if (typeof item.getAsFile === 'function') {
              const file = item.getAsFile();
              if (file && file.name.toLowerCase().endsWith('.stl')) {
                droppedFiles.push(file);
              }
            }
          }
        }
        if (promises.length > 0) {
          const filesArrays = await Promise.all(promises);
          droppedFiles.push(...filesArrays.flat());
        }
      } else if (e.dataTransfer.files) {
        const rawFiles = Array.from(e.dataTransfer.files);
        droppedFiles.push(...rawFiles.filter(f => f.name.toLowerCase().endsWith('.stl')));
      }
    } catch (err: any) {
      console.error("Exception inside handleDrop:", err);
      setErrorMessage("Error processing drop action: " + (err.message || err));
    }

    if (droppedFiles.length > 0) {
      // Append and slice to max 2 STL files
      const newFiles = [...files, ...droppedFiles].slice(0, 2);
      setFiles(newFiles);
      
      if (droppedFiles.length > 2 || (files.length + droppedFiles.length) > 2) {
        setErrorMessage("Only 2 STL mesh files can be processed. Additional files were ignored.");
      }
    } else {
      setErrorMessage("No valid STL files found in the drop area.");
    }
  };

  const handleBrowseFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMessage(null);
    if (e.target.files) {
      const selected = Array.from(e.target.files).filter(f => f.name.toLowerCase().endsWith('.stl'));
      const newFiles = [...files, ...selected].slice(0, 2);
      setFiles(newFiles);
      e.target.value = ''; // Reset input value so same files can be chosen again if removed
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setPreviewVisibility(prev => {
      if (index === 0) {
        return { ...prev, mesh1: true };
      } else {
        return { ...prev, mesh2: true };
      }
    });
    setErrorMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (files.length < 2) {
      setErrorMessage("Please upload exactly two STL mesh files to build the model.");
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);
    setSubmitStep(1); // Uploading

    try {
      // 1. Upload files
      const uploadData = new FormData();
      uploadData.append('mesh1', files[0]);
      uploadData.append('mesh2', files[1]);

      const uploadRes = await fetch(`${API_URL}/upload`, {
        method: 'POST',
        body: uploadData,
      });

      if (!uploadRes.ok) {
        const errJson = await uploadRes.json();
        throw new Error(errJson.detail || "Failed to upload dental meshes.");
      }

      const uploadResult = await uploadRes.json();
      const uid = uploadResult.uid;

      if (!uid) {
        throw new Error("Case UID was not generated during upload.");
      }

      // 2. Build Model
      setSubmitStep(2); // Building (this takes the longest)
      
      const buildData = new FormData();
      buildData.append('uid', uid);
      buildData.append('arch_type', archType);
      
      // Construct FDI range parameters
      const upperRange = archType === 'custom' ? `${fdiUpperStart}-${fdiUpperEnd}` : '';
      const lowerRange = archType === 'custom' ? `${fdiLowerStart}-${fdiLowerEnd}` : '';
      buildData.append('custom_range_upper', upperRange);
      buildData.append('custom_range_lower', lowerRange);
      
      buildData.append('base_type', baseType);
      buildData.append('palatte', palate ? 'true' : 'false');
      buildData.append('drain_holes', drainHoles ? 'true' : 'false');
      
      // Engraving text mappings
      const enableText = labelTextOption !== 'none';
      let textToEngrave = '';
      if (labelTextOption === 'filename') {
        // Strip extension, trim to 8 chars
        textToEngrave = files[0].name.replace(/\.[^/.]+$/, "").slice(0, 8);
      } else if (labelTextOption === 'custom') {
        textToEngrave = customLabelText.slice(0, 8);
      }

      buildData.append('enable_text_label', enableText ? 'true' : 'false');
      buildData.append('text_label', textToEngrave);
      
      // Float settings
      buildData.append('base_height', baseHeight.toFixed(1));
      buildData.append('shell_thickness', shellThickness.toFixed(1));

      const buildRes = await fetch(`${API_URL}/build-model`, {
        method: 'POST',
        body: buildData,
      });

      if (!buildRes.ok) {
        const errJson = await buildRes.json();
        throw new Error(errJson.detail || "Pipeline failed to build dental models.");
      }

      const buildResult = await buildRes.json();

      // 3. Final Step: Navigating to the visualization page
      setSubmitStep(3);
      setTimeout(() => {
        router.push(`/viewer/${uid}`);
      }, 800);

    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "An unexpected error occurred during processing.");
      setIsSubmitting(false);
      setSubmitStep(0);
    }
  };

  return (
    <div className="app-container">
      {/* Header bar */}
      <header className="header">
        <div className="logo-container">
          <img src="/dentalai_logo.png" alt="Dental AI Logo" style={{ height: '28px', objectFit: 'contain' }} />
          <h1 className="logo-text" style={{ marginLeft: '0.5rem' }}>MODEL BUILDER</h1>
        </div>
      </header>

      {/* Main Split Grid */}
      <main className="main-content">
        
        {/* Left Form Panel */}
        <section className="form-panel">
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            
            {/* Title / Description */}
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white mb-1 flex items-center gap-2">
                <Sliders size={20} className="text-[#06b6d4]" /> Setup Parameters
              </h2>
              <p className="text-xs text-slate-400">
                Upload scans
              </p>
            </div>

            {/* Drag & Drop Upload Zone */}
            <div className="form-group">
              <label className="form-label">
                <span>Intraoral Scans (2 STL Files)</span>
                <span className="text-xs text-[#06b6d4]">{files.length}/2 Files</span>
              </label>

              <div 
                className={`dropzone ${isDragging ? 'dropzone-active' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input 
                  type="file" 
                  ref={fileInputRef}
                  style={{ display: 'none' }} 
                  multiple 
                  accept=".stl"
                  onChange={handleBrowseFiles}
                />
                
                <div className="dropzone-content">
                  <Upload className="dropzone-icon" size={32} />
                  <p className="dropzone-title">Drag & Drop files or folder here</p>
                  <p className="dropzone-subtitle">Accepts max 2 STL scans. Or click to browse.</p>
                </div>
              </div>

              {/* Uploaded File List */}
              {files.length > 0 && (
                <div className="file-list">
                  {files.map((file, idx) => (
                    <div key={idx} className="file-item">
                      <div className="flex flex-col gap-0.5 overflow-hidden">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <FileCode size={14} className="text-[#06b6d4] shrink-0" />
                          <span className="file-name text-xs text-slate-200 truncate" title={file.name}>{file.name}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="file-size text-[11px]">{(file.size / (1024 * 1024)).toFixed(2)} MB</span>
                        
                        <button
                          type="button"
                          onClick={() => {
                            const key = idx === 0 ? 'mesh1' : 'mesh2';
                            setPreviewVisibility(prev => ({
                              ...prev,
                              [key]: !prev[key]
                            }));
                          }}
                          className="file-remove text-slate-400 hover:text-[#06b6d4]"
                          title={idx === 0 ? (previewVisibility.mesh1 ? "Hide mesh" : "Show mesh") : (previewVisibility.mesh2 ? "Hide mesh" : "Show mesh")}
                        >
                          {idx === 0 
                            ? (previewVisibility.mesh1 ? <Eye size={14} /> : <EyeOff size={14} />) 
                            : (previewVisibility.mesh2 ? <Eye size={14} /> : <EyeOff size={14} />)
                          }
                        </button>

                        <button type="button" onClick={() => removeFile(idx)} className="file-remove text-slate-400 hover:text-red-400">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Arch Type dropdown */}
            <div className="form-group">
              <label className="form-label">Arch Selection</label>
              <select 
                className="form-select"
                value={archType}
                onChange={(e) => setArchType(e.target.value as any)}
              >
                <option value="full">Full Arch (Standard)</option>
                <option value="premolar">Premolar Segment</option>
                <option value="anterior">Anterior (Canine-to-Canine)</option>
                <option value="custom">Custom Teeth Range (FDI)</option>
              </select>
            </div>

            {/* FDI selector (Conditional) */}
            {archType === 'custom' && (
              <div className="fdi-container">
                <div className="fdi-row">
                  <span className="fdi-label">Maxilla Range (Upper Teeth)</span>
                  <div className="fdi-inputs">
                    <select value={fdiUpperStart} onChange={(e) => setFdiUpperStart(e.target.value)}>
                      {fdiUpperTeeth.map(t => <option key={t} value={t}>Tooth {t}</option>)}
                    </select>
                    <span className="text-slate-500 font-bold">to</span>
                    <select value={fdiUpperEnd} onChange={(e) => setFdiUpperEnd(e.target.value)}>
                      {fdiUpperTeeth.map(t => <option key={t} value={t}>Tooth {t}</option>)}
                    </select>
                  </div>
                </div>

                <div className="fdi-row">
                  <span className="fdi-label">Mandible Range (Lower Teeth)</span>
                  <div className="fdi-inputs">
                    <select value={fdiLowerStart} onChange={(e) => setFdiLowerStart(e.target.value)}>
                      {fdiLowerTeeth.map(t => <option key={t} value={t}>Tooth {t}</option>)}
                    </select>
                    <span className="text-slate-500 font-bold">to</span>
                    <select value={fdiLowerEnd} onChange={(e) => setFdiLowerEnd(e.target.value)}>
                      {fdiLowerTeeth.map(t => <option key={t} value={t}>Tooth {t}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Base Type dropdown */}
            <div className="form-group">
              <label className="form-label">Base Type Layout</label>
              <select 
                className="form-select"
                value={baseType}
                onChange={(e) => setBaseType(e.target.value as any)}
              >
                <option value="solid">Solid (Standard Plaster)</option>
                <option value="hollow">Hollow (Saves Material)</option>
                <option value="honeycomb">Honeycomb (Rigid Grid)</option>
              </select>
            </div>

            {/* Palate dropdown */}
            <div className="form-group">
              <label className="form-label">
                <span>Palate Closure</span>
                {archType !== 'full' && (
                  <span className="text-[10px] text-amber-500 flex items-center gap-1 font-semibold normal-case">
                    <AlertCircle size={10} /> Lock (Full Arch only)
                  </span>
                )}
              </label>
              <select 
                className="form-select"
                value={palate ? 'true' : 'false'}
                onChange={(e) => setPalate(e.target.value === 'true')}
                disabled={archType !== 'full'}
              >
                <option value="false">Horseshoe (Open Base)</option>
                <option value="true">Closed Palate (Filled Tongue Area)</option>
              </select>
            </div>

            {/* Drain Holes dropdown */}
            <div className="form-group">
              <label className="form-label">
                <span>Side Drain Holes</span>
                {baseType === 'solid' && (
                  <span className="text-[10px] text-amber-500 flex items-center gap-1 font-semibold normal-case">
                    <AlertCircle size={10} /> Lock (Hollow/Honeycomb only)
                  </span>
                )}
              </label>
              <select 
                className="form-select"
                value={drainHoles ? 'true' : 'false'}
                onChange={(e) => setDrainHoles(e.target.value === 'true')}
                disabled={baseType === 'solid'}
              >
                <option value="false">No (Closed Walls)</option>
                <option value="true">Yes (Add Vent Holes)</option>
              </select>
            </div>

            {/* Base Height slider */}
            <div className="form-group">
              <label className="form-label">
                <span>Base Vertical Height</span>
                <span className="text-xs text-slate-400 font-normal">Min 2.0 - Max 5.0 mm</span>
              </label>
              <div className="range-container">
                <input 
                  type="range" 
                  className="range-slider" 
                  min="2.0" 
                  max="5.0" 
                  step="0.1" 
                  value={baseHeight}
                  onChange={(e) => setBaseHeight(parseFloat(e.target.value))}
                />
                <span className="range-value">{baseHeight.toFixed(1)} mm</span>
              </div>
            </div>

            {/* Shell Thickness slider */}
            <div className="form-group">
              <label className="form-label">
                <span>Shell Thickness</span>
                <span className="text-xs text-slate-400 font-normal">Min 0.5 - Max 3.0 mm</span>
              </label>
              <div className="range-container">
                <input 
                  type="range" 
                  className="range-slider" 
                  min="0.5" 
                  max="3.0" 
                  step="0.1" 
                  value={shellThickness}
                  onChange={(e) => setShellThickness(parseFloat(e.target.value))}
                />
                <span className="range-value">{shellThickness.toFixed(1)} mm</span>
              </div>
            </div>

            {/* Label Text selection */}
            <div className="form-group">
              <label className="form-label">3D Engraving Text</label>
              <select 
                className="form-select"
                value={labelTextOption}
                onChange={(e) => setLabelTextOption(e.target.value as any)}
              >
                <option value="filename">Filename (First 8 Characters)</option>
                <option value="custom">Custom Text Label</option>
                <option value="none">No Text Label (Disable)</option>
              </select>
            </div>

            {/* Custom text textbox */}
            {labelTextOption === 'custom' && (
              <div className="form-group">
                <label className="form-label">
                  <span>Custom text string</span>
                  <span className="text-[10px] text-slate-500 normal-case">Max 8 characters</span>
                </label>
                <input 
                  type="text" 
                  className="form-input" 
                  maxLength={8}
                  value={customLabelText}
                  onChange={(e) => setCustomLabelText(e.target.value)}
                  placeholder="Enter text..."
                />
              </div>
            )}

            {/* Validation / Info Banner */}
            {errorMessage && (
              <div className="p-3 bg-red-950/40 border border-red-900/50 rounded-lg flex items-start gap-2 text-xs text-red-200">
                <AlertCircle className="shrink-0 text-red-400" size={14} />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Submit Button */}
            <button 
              type="submit" 
              className="submit-btn mt-2" 
              disabled={files.length < 2 || isSubmitting}
            >
              <Sparkles size={18} /> Build Watertight model
            </button>

          </form>
        </section>

        {/* Right Preview Panel */}
        <section className="preview-panel">
          {/* Header Indicators */}
          <div className="preview-badge border-b border-white/5">
            <span className={`badge-dot ${files.length === 2 ? 'pulse' : ''}`} />
            <span>{files.length === 2 ? 'Local 3D Preview Active' : 'Waiting for Files'}</span>
          </div>

          {files.length === 2 && !isSubmitting && (
            <div className="flex gap-5 px-6 py-2.5 bg-slate-950/30 border-b border-white/5 text-[11px] text-slate-400 select-none">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full bg-[#3b82f6] shrink-0 border border-white/15" style={{ opacity: previewVisibility.mesh1 ? 1 : 0.4 }} />
                <span className="truncate text-slate-300 font-semibold" style={{ opacity: previewVisibility.mesh1 ? 1 : 0.4 }} title={files[0].name}>{files[0].name}</span>
              </div>
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full bg-[#94a3b8] shrink-0 border border-white/15" style={{ opacity: previewVisibility.mesh2 ? 1 : 0.4 }} />
                <span className="truncate text-slate-300 font-semibold" style={{ opacity: previewVisibility.mesh2 ? 1 : 0.4 }} title={files[1].name}>{files[1].name}</span>
              </div>
            </div>
          )}

          <div className="canvas-container">
            {files.length === 2 && !isSubmitting ? (
              <ThreeViewer 
                previewFiles={{
                  mesh1: files[0],
                  mesh2: files[1]
                }}
                previewVisibility={previewVisibility}
              />
            ) : (
              <div className="preview-placeholder">
                <div className="placeholder-wireframe">
                  <FileCode className="placeholder-inner-icon" size={40} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white mb-1">Awaiting Intraoral Scans...</h3>
                  <p className="text-xs text-slate-400 max-w-sm px-6">
                    Drag and drop a folder containing two STL scan meshes (Maxilla and Mandible) or select them directly. Live 3D visualization will initialize.
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>

      </main>

      {/* Loading Overlay (Build Process Pipeline) */}
      {isSubmitting && (
        <div className="loading-overlay">
          <div className="loader-spinner" />
          <h2 className="loading-title">Orchestrating Model pipeline</h2>
          
          <div className="loading-steps">
            <div className={`loading-step ${submitStep >= 1 ? (submitStep > 1 ? 'completed' : 'active') : ''}`}>
              <div className="step-bullet">1</div>
              <span>Uploading original STL scans to storage</span>
            </div>
            
            <div className={`loading-step ${submitStep >= 2 ? (submitStep > 2 ? 'completed' : 'active') : ''}`}>
              <div className="step-bullet">2</div>
              <span>Processing watertight dental pipeline</span>
            </div>

            <div className={`loading-step ${submitStep >= 3 ? (submitStep > 3 ? 'completed' : 'active') : ''}`}>
              <div className="step-bullet">3</div>
              <span>Preparing rendering scene</span>
            </div>
          </div>

          {/* Running Timer */}
          {submitStep === 2 && (
            <div className="flex flex-col items-center gap-1 mt-4">
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <Clock size={12} /> Time elapsed
              </span>
              <span className="timer-text">{elapsedTime}s</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
