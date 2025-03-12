import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import {
  AiOutlineHome,
  AiOutlineFile,
  AiOutlineUnorderedList,
  AiOutlineClose,
  AiOutlineUndo,
  AiOutlineRedo,
  AiOutlineSave,
  AiOutlinePlusSquare,
  AiOutlineAudio,
  AiOutlineStop
} from 'react-icons/ai';
import { FaTrashAlt } from 'react-icons/fa';
import { saveToIndexedDB, getAllFromIndexedDB } from './indexedDB';

// Helper to get the user's name (prompted since browsers can’t access the computer name)
function getUserName() {
  let name = localStorage.getItem('userName');
  if (!name) {
    name = prompt('What is your name?') || 'User';
    localStorage.setItem('userName', name);
  }
  return name;
}

// ====================== PageRow Component ======================
function PageRow({
  page,
  index,
  reorderPages,
  updatePage,
  onDragStartPage,
  onDropOnRow,
  deletePage,
  className
}) {
  const { id, pageNumber, pageName, image, dialogue, context, timestamp, audio } = page;
  const [isHolding, setIsHolding] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const holdTimerRef = useRef(null);

  const handleImageMouseDown = () => {
    if (!image) {
      document.getElementById(`fileInput-${id}`).click();
      return;
    }
    setIsHolding(true);
    setHoldProgress(0);
    holdTimerRef.current = setInterval(() => {
      setHoldProgress((prev) => {
        if (prev >= 100) {
          clearInterval(holdTimerRef.current);
          updatePage(index, { image: '' });
          setIsHolding(false);
          return 0;
        }
        return prev + 5;
      });
    }, 100);
  };

  const handleImageMouseUp = () => {
    if (holdTimerRef.current) clearInterval(holdTimerRef.current);
    if (holdProgress < 100 && image) {
      document.getElementById(`fileInput-${id}`).click();
    }
    setIsHolding(false);
    setHoldProgress(0);
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (ev) => {
        updatePage(index, { image: ev.target.result });
      };
      reader.readAsDataURL(file);
    }
  };

  // Drag and Drop Logic
  const handleDragStart = (e) => {
    e.dataTransfer.setData('text/plain', index.toString());
    onDragStartPage(index);
  };
  const handleDragOver = (e) => { e.preventDefault(); };
  const handleDrop = (e) => {
    e.preventDefault();
    const sourceIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (sourceIndex !== index) {
      onDropOnRow(sourceIndex, index);
    }
  };
  const handleDragStartIcon = (e) => {
    e.dataTransfer.setData('text/plain', index.toString());
    onDragStartPage(index);
  };

  // Audio Playback and Recording Logic
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [recording, setRecording] = useState(false);
  const audioChunksRef = useRef([]);

  useEffect(() => {
    if (audioRef.current) {
      const handleLoadedMetadata = () => setDuration(audioRef.current.duration || 0);
      const handleTimeUpdate = () => setCurrentTime(audioRef.current.currentTime);
      const handleEnded = () => setIsPlaying(false);
      const audioEl = audioRef.current;
      audioEl.addEventListener('loadedmetadata', handleLoadedMetadata);
      audioEl.addEventListener('timeupdate', handleTimeUpdate);
      audioEl.addEventListener('ended', handleEnded);
      return () => {
        audioEl.removeEventListener('loadedmetadata', handleLoadedMetadata);
        audioEl.removeEventListener('timeupdate', handleTimeUpdate);
        audioEl.removeEventListener('ended', handleEnded);
      };
    }
  }, [audio]);

  const handlePlayPause = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };
  const handleStop = () => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    setIsPlaying(false);
  };
  const handleSliderChange = (e) => {
    if (!audioRef.current) return;
    const newTime = parseFloat(e.target.value);
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };
  const handleImportAudio = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (ev) => {
        updatePage(index, { audio: ev.target.result });
      };
      reader.readAsDataURL(file);
    }
  };
  const handleDeleteAudio = () => {
    updatePage(index, { audio: '' });
    handleStop();
  };
  const startRecording = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert('Recording not supported in this browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => { audioChunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        audioChunksRef.current = [];
        const reader = new FileReader();
        reader.onload = (ev) => {
          updatePage(index, { audio: ev.target.result });
        };
        reader.readAsDataURL(blob);
      };
      recorder.start();
      setMediaRecorder(recorder);
      setRecording(true);
    } catch (error) {
      console.error('Error accessing microphone:', error);
    }
  };
  const stopRecording = () => {
    if (mediaRecorder) {
      mediaRecorder.stop();
      setRecording(false);
      setMediaRecorder(null);
    }
  };

  return (
    <tr
      className={`page-row ${className}`}
      draggable
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <td className="page-number-col drag-handle" title="Drag to reorder" draggable onDragStart={handleDragStartIcon}>
        <span className="page-number">{pageNumber}</span>
        <span className="drag-icon">☰</span>
      </td>
      <td className="resizable-col">
        <div className="cell-content">
          <input
            type="text"
            className="page-name-input"
            placeholder="Page Name (optional)"
            value={pageName || ''}
            onChange={(e) => updatePage(index, { pageName: e.target.value })}
          />
        </div>
      </td>
      <td className="resizable-col image-cell">
        {image ? (
          <div className="resizable-image-container">
            <div className="image-wrapper" onMouseDown={handleImageMouseDown} onMouseUp={handleImageMouseUp}>
              <img src={image} alt="preview" className="image-preview" />
              {isHolding && (
                <div className="hold-overlay">
                  <div className="hold-progress" style={{ width: `${holdProgress}%` }}></div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <button onClick={() => document.getElementById(`fileInput-${id}`).click()}>
            + Image
          </button>
        )}
        <input type="file" id={`fileInput-${id}`} style={{ display: 'none' }} accept="image/*" onChange={handleFileChange} />
      </td>
      <td className="resizable-col">
        <div className="cell-content">
          <textarea
            placeholder="Enter dialogue or script"
            value={dialogue}
            onChange={(e) => updatePage(index, { dialogue: e.target.value })}
          />
        </div>
      </td>
      <td className="resizable-col">
        <div className="cell-content">
          <textarea
            placeholder="Enter context or notes"
            value={context}
            onChange={(e) => updatePage(index, { context: e.target.value })}
          />
        </div>
      </td>
      <td className="resizable-col">
        <div className="cell-content">
          <input
            type="text"
            className="timestamp-input"
            placeholder="Timestamp (optional)"
            value={timestamp || ''}
            onChange={(e) => updatePage(index, { timestamp: e.target.value })}
          />
          <div className="audio-controls">
            {audio ? (
              <>
                <audio ref={audioRef} src={audio} style={{ display: 'none' }} />
                <button onClick={handlePlayPause}>{isPlaying ? 'Pause' : 'Play'}</button>
                <button onClick={handleStop}><AiOutlineStop /></button>
                <input
                  type="range"
                  min={0}
                  max={duration || 0}
                  step="0.1"
                  value={currentTime}
                  onChange={handleSliderChange}
                  disabled={!audio}
                />
                <button onClick={handleDeleteAudio}>Delete Audio</button>
              </>
            ) : (
              <>
                <input type="file" accept="audio/*" onChange={handleImportAudio} style={{ display: 'none' }} id={`audioInput-${id}`} />
                <button onClick={() => document.getElementById(`audioInput-${id}`).click()}>Import</button>
                {!recording && <button onClick={startRecording}>Record</button>}
                {recording && <button onClick={stopRecording}>Stop</button>}
              </>
            )}
          </div>
        </div>
      </td>
      <td className="delete-col">
        <button className="delete-button" onClick={() => deletePage(index)}>
          <FaTrashAlt />
        </button>
      </td>
    </tr>
  );
}

// ====================== StoryboardTab Component ======================
function StoryboardTab({ storyboard, setStoryboard, onCloseTab, unsavedChanges, setUnsavedChanges }) {
  const { name, past, present, future } = storyboard;
  const [playingSceneIndex, setPlayingSceneIndex] = useState(null);

  const pushToHistory = (newPresent) => {
    const updatedSb = {
      ...storyboard,
      past: [...past, present],
      present: newPresent,
      future: []
    };
    setStoryboard(updatedSb);
    setUnsavedChanges(true);
  };

  const undo = () => {
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    const newPast = past.slice(0, -1);
    const updatedSb = {
      ...storyboard,
      past: newPast,
      present: previous,
      future: [present, ...future]
    };
    setStoryboard(updatedSb);
    setUnsavedChanges(true);
  };

  const redo = () => {
    if (future.length === 0) return;
    const next = future[0];
    const newFuture = future.slice(1);
    const updatedSb = {
      ...storyboard,
      past: [...past, present],
      present: next,
      future: newFuture
    };
    setStoryboard(updatedSb);
    setUnsavedChanges(true);
  };

  const addPage = () => {
    const newPages = [...present.pages];
    newPages.push({
      id: Date.now(),
      pageNumber: newPages.length + 1,
      pageName: '',
      image: '',
      dialogue: '',
      context: '',
      timestamp: '',
      audio: ''
    });
    pushToHistory({ pages: newPages });
  };

  const reorderPages = (newPages) => {
    newPages.forEach((p, i) => {
      p.pageNumber = i + 1;
    });
    pushToHistory({ pages: newPages });
  };

  const updatePage = (index, changes) => {
    const newPages = [...present.pages];
    newPages[index] = { ...newPages[index], ...changes };
    pushToHistory({ pages: newPages });
  };

  const deletePage = (index) => {
    const newPages = present.pages.filter((_, idx) => idx !== index);
    pushToHistory({ pages: newPages });
  };

  const saveStoryboard = () => {
    const fullData = { name, pages: present.pages };
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(fullData, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute('href', dataStr);
    downloadAnchorNode.setAttribute('download', name + '.json');
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    setUnsavedChanges(false);
  };

  useEffect(() => {
    const table = document.querySelector('.pages-table');
    if (!table) return;
    const headerCells = table.querySelectorAll('th.resizable-col');
    
    headerCells.forEach((th) => {
      // Avoid adding multiple resizers
      if (th.querySelector('.col-resizer')) return;
  
      const resizer = document.createElement('div');
      resizer.className = 'col-resizer';
      // These inline styles can also be moved to your CSS file.
      resizer.style.width = '5px';
      resizer.style.height = '100%';
      resizer.style.position = 'absolute';
      resizer.style.top = '0';
      resizer.style.right = '0';
      resizer.style.cursor = 'col-resize';
      resizer.style.userSelect = 'none';
      
      th.style.position = 'relative';
      th.appendChild(resizer);
  
      let startX;
      let startWidth;
  
      const mouseDownHandler = (e) => {
        startX = e.clientX;
        startWidth = th.offsetWidth;
        document.addEventListener('mousemove', mouseMoveHandler);
        document.addEventListener('mouseup', mouseUpHandler);
      };
  
      const mouseMoveHandler = (e) => {
        const dx = e.clientX - startX;
        th.style.width = `${startWidth + dx}px`;
        // Optionally, you could also update the width of corresponding td cells here.
      };
  
      const mouseUpHandler = () => {
        document.removeEventListener('mousemove', mouseMoveHandler);
        document.removeEventListener('mouseup', mouseUpHandler);
      };
  
      resizer.addEventListener('mousedown', mouseDownHandler);
    });
  }, [present.pages]);
  
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        undo();
      } else if (e.ctrlKey && e.key === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  const onDragStartPage = (index) => {};
  const onDropOnRow = (sourceIndex, targetIndex) => {
    const pages = [...present.pages];
    const [movedPage] = pages.splice(sourceIndex, 1);
    pages.splice(targetIndex, 0, movedPage);
    reorderPages(pages);
  };

  const playAllAudioSequentially = () => {
    const pagesWithAudio = present.pages.filter((p) => p.audio);
    if (pagesWithAudio.length === 0) return;
    let current = 0;
    setPlayingSceneIndex(current);
    const audioEl = new Audio(pagesWithAudio[current].audio);
    audioEl.play();
    audioEl.addEventListener('ended', () => {
      current++;
      if (current < pagesWithAudio.length) {
        setPlayingSceneIndex(current);
        audioEl.src = pagesWithAudio[current].audio;
        audioEl.play();
      } else {
        setPlayingSceneIndex(null);
      }
    });
  };

  // Revised Fullscreen Play Function
  const playFullscreen = () => {
    const pages = present.pages;
    let current = 0;
    const fullscreenDiv = document.createElement('div');
    fullscreenDiv.style.position = 'fixed';
    fullscreenDiv.style.top = '0';
    fullscreenDiv.style.left = '0';
    fullscreenDiv.style.width = '100%';
    fullscreenDiv.style.height = '100%';
    fullscreenDiv.style.backgroundColor = 'black';
    fullscreenDiv.style.color = 'white';
    fullscreenDiv.style.display = 'flex';
    fullscreenDiv.style.flexDirection = 'column';
    fullscreenDiv.style.alignItems = 'center';
    fullscreenDiv.style.justifyContent = 'center';
    fullscreenDiv.style.zIndex = '9999';
    fullscreenDiv.style.textAlign = 'center';
    fullscreenDiv.style.padding = '20px';

    const exitButton = document.createElement('button');
    exitButton.innerText = 'Exit Fullscreen';
    exitButton.style.position = 'absolute';
    exitButton.style.top = '20px';
    exitButton.style.right = '20px';
    exitButton.style.padding = '10px 15px';
    exitButton.style.fontSize = '1rem';
    exitButton.style.cursor = 'pointer';
    exitButton.onclick = () => {
      document.exitFullscreen();
      if (fullscreenDiv.parentNode) fullscreenDiv.parentNode.removeChild(fullscreenDiv);
    };
    fullscreenDiv.appendChild(exitButton);

    const showPage = (page) => {
      fullscreenDiv.innerHTML = '';
      fullscreenDiv.appendChild(exitButton);
      if (page.image) {
        const img = document.createElement('img');
        img.src = page.image;
        img.style.maxWidth = '80%';
        img.style.maxHeight = '60%';
        fullscreenDiv.appendChild(img);
      }
      if (page.dialogue) {
        const dialogue = document.createElement('p');
        dialogue.textContent = page.dialogue;
        dialogue.style.fontSize = '1.5rem';
        dialogue.style.marginTop = '20px';
        fullscreenDiv.appendChild(dialogue);
      }
      if (page.context) {
        const context = document.createElement('p');
        context.textContent = page.context;
        context.style.fontSize = '1.2rem';
        context.style.marginTop = '10px';
        fullscreenDiv.appendChild(context);
      }
      if (page.audio) {
        const audioEl = document.createElement('audio');
        audioEl.src = page.audio;
        audioEl.autoplay = true;
        fullscreenDiv.appendChild(audioEl);
        return new Promise((resolve) => {
          audioEl.onended = resolve;
          setTimeout(resolve, (parseFloat(page.timestamp) || 5) * 1000);
        });
      } else {
        return new Promise((resolve) => {
          setTimeout(resolve, (parseFloat(page.timestamp) || 5) * 1000);
        });
      }
    };

    const playNext = async () => {
      if (current >= pages.length) {
        document.exitFullscreen();
        if (fullscreenDiv.parentNode) fullscreenDiv.parentNode.removeChild(fullscreenDiv);
        return;
      }
      await showPage(pages[current]);
      current++;
      playNext();
    };

    document.body.appendChild(fullscreenDiv);
    fullscreenDiv.requestFullscreen();
    playNext();
  };

  return (
    <div className="storyboard-tab fade-in">
      <header className="editor-header">
        <h1>{name}</h1>
        <div>
          <button className="icon-button" onClick={undo} disabled={past.length === 0}>
            <AiOutlineUndo /> Undo
          </button>
          <button className="icon-button" onClick={redo} disabled={future.length === 0}>
            <AiOutlineRedo /> Redo
          </button>
          <button className="icon-button" onClick={addPage}>
            <AiOutlinePlusSquare /> Add Page
          </button>
          <button className="icon-button" onClick={saveStoryboard}>
            <AiOutlineSave /> Save
          </button>
          <button className="icon-button" onClick={playAllAudioSequentially}>
            <AiOutlineAudio /> Play All
          </button>
          <button className="icon-button" onClick={playFullscreen}>
            <AiOutlineAudio /> Fullscreen Play
          </button>
          <button className="icon-button" onClick={onCloseTab}>
            <AiOutlineClose />
          </button>
        </div>
      </header>
      <table className="pages-table">
        <thead>
          <tr>
            <th className="page-number-col">Page #</th>
            <th className="resizable-col">Page Name</th>
            <th className="resizable-col">Image</th>
            <th className="resizable-col">Dialogue / Script</th>
            <th className="resizable-col">Context / Notes</th>
            <th className="resizable-col">Timestamp & Audio</th>
            <th className="delete-col">Delete</th>
          </tr>
        </thead>
        <tbody>
          {present.pages.map((page, index) => (
            <PageRow
              key={page.id}
              page={page}
              index={index}
              reorderPages={reorderPages}
              updatePage={updatePage}
              onDragStartPage={onDragStartPage}
              onDropOnRow={onDropOnRow}
              deletePage={deletePage}
              className={playingSceneIndex === index ? 'playing-scene' : ''}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ====================== Main App Component ======================
function App() {
  const [hasCompletedSetup, setHasCompletedSetup] = useState(() => localStorage.getItem('hasCompletedSetup') === 'true');
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') === 'true');
  const [showWelcome, setShowWelcome] = useState(true);
  const [openStoryboards, setOpenStoryboards] = useState([]);
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [unsavedChanges, setUnsavedChanges] = useState(false);

  const saveToLocalStorage = (key, value) => {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.error('Error saving to localStorage', e);
    }
  };

  useEffect(() => {
    getAllFromIndexedDB().then((data) => {
      if (data) setOpenStoryboards(data);
    });
  }, []);

  useEffect(() => {
    openStoryboards.forEach((storyboard) => {
      saveToIndexedDB(storyboard);
    });
  }, [openStoryboards]);

  useEffect(() => {
    const storedTabIndex = localStorage.getItem('activeTabIndex');
    if (storedTabIndex) setActiveTabIndex(parseInt(storedTabIndex, 10));
  }, []);

  useEffect(() => {
    saveToLocalStorage('activeTabIndex', activeTabIndex.toString());
  }, [activeTabIndex]);

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (unsavedChanges) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [unsavedChanges]);

  // Updated completeSetup now sets hasCompletedSetup to true
  const completeSetup = (selectedDarkMode) => {
    setDarkMode(selectedDarkMode);
    saveToLocalStorage('darkMode', selectedDarkMode);
    saveToLocalStorage('hasCompletedSetup', 'true');
    setHasCompletedSetup(true);
    setShowWelcome(true);
  };

  const goToWelcome = () => setShowWelcome(true);

  const createNewStoryboard = () => {
    const name = prompt('Enter a name for your new storyboard:');
    if (name) {
      const newSb = { id: Date.now(), name, past: [], present: { pages: [] }, future: [] };
      setOpenStoryboards([...openStoryboards, newSb]);
      setActiveTabIndex(openStoryboards.length);
      setUnsavedChanges(true);
      setShowWelcome(false);
    }
  };

  const openStoryboardFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const loaded = JSON.parse(event.target.result);
        if (!loaded.name || !loaded.pages) {
          alert('Invalid storyboard file.');
          return;
        }
        const newSb = { id: Date.now(), name: loaded.name, past: [], present: { pages: loaded.pages }, future: [] };
        setOpenStoryboards([...openStoryboards, newSb]);
        setActiveTabIndex(openStoryboards.length);
        setUnsavedChanges(true);
        setShowWelcome(false);
      } catch (error) {
        alert('Error reading storyboard file.');
      }
    };
    reader.readAsText(file);
  };

  // Function to open a recent storyboard from the welcome screen.
  const openStoryboardFromRecent = (storyboard) => {
    const index = openStoryboards.findIndex(sb => sb.id === storyboard.id);
    if (index >= 0) {
      setActiveTabIndex(index);
    } else {
      setOpenStoryboards([...openStoryboards, storyboard]);
      setActiveTabIndex(openStoryboards.length);
    }
    setShowWelcome(false);
  };

  if (!hasCompletedSetup) return <SetupWizard onCompleteSetup={completeSetup} />;

  if (showWelcome) {
    return (
      <WelcomeScreen
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        onCreateNew={createNewStoryboard}
        onOpenStoryboard={openStoryboardFile}
        onContinue={() => {
          if (openStoryboards.length > 0) setShowWelcome(false);
          else createNewStoryboard();
        }}
        onOpenRecent={openStoryboardFromRecent}
      />
    );
  }

  return (
    <div className={`App ${darkMode ? 'dark' : 'light'}`}>
      <aside className="sidebar">
        <h2>Storyboard Creator</h2>
        <nav>
          <ul>
            <li onClick={goToWelcome}>
              <AiOutlineHome className="icon" />
              <span>Home</span>
            </li>
            <li onClick={createNewStoryboard}>
              <AiOutlineFile className="icon" />
              <span>New Storyboard</span>
            </li>
            <li>
              <label htmlFor="openFile" className="file-label">
                <AiOutlineUnorderedList className="icon" />
                <span>Open Storyboard</span>
              </label>
              <input id="openFile" type="file" accept=".json" onChange={openStoryboardFile} style={{ display: 'none' }} />
            </li>
          </ul>
        </nav>
      </aside>
      <main className="editor-content fade-in">
        <div className="tab-bar">
          {openStoryboards.map((sb, idx) => (
            <div
              key={sb.id}
              className={`tab ${idx === activeTabIndex ? 'active-tab' : ''}`}
              onClick={() => setActiveTabIndex(idx)}
            >
              <span className="tab-name">{sb.name}</span>
              <AiOutlineClose
                className="tab-close"
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm('Close this storyboard? Unsaved changes will be lost unless you saved.')) {
                    const updated = [...openStoryboards];
                    updated.splice(idx, 1);
                    setOpenStoryboards(updated);
                    if (activeTabIndex >= updated.length) setActiveTabIndex(updated.length - 1);
                    if (updated.length === 0) setShowWelcome(true);
                  }
                }}
              />
            </div>
          ))}
        </div>
        {openStoryboards.length > 0 && activeTabIndex >= 0 && activeTabIndex < openStoryboards.length && (
          <StoryboardTab
            storyboard={openStoryboards[activeTabIndex]}
            setStoryboard={(updated) => {
              const updatedStoryboards = [...openStoryboards];
              updatedStoryboards[activeTabIndex] = updated;
              setOpenStoryboards(updatedStoryboards);
            }}
            onCloseTab={() => {
              if (window.confirm('Close this storyboard? Unsaved changes will be lost unless you saved.')) {
                const updated = [...openStoryboards];
                updated.splice(activeTabIndex, 1);
                setOpenStoryboards(updated);
                if (activeTabIndex >= updated.length) setActiveTabIndex(updated.length - 1);
                if (updated.length === 0) setShowWelcome(true);
              }
            }}
            unsavedChanges={unsavedChanges}
            setUnsavedChanges={setUnsavedChanges}
          />
        )}
      </main>
    </div>
  );
}

function SetupWizard({ onCompleteSetup }) {
  return (
    <div className="setup-wizard slide-in">
      <h1>Welcome to Storyboard Creator</h1>
      <p>Please choose your preferred color mode to get started:</p>
      <div className="wizard-buttons">
        <button onClick={() => onCompleteSetup(false)}>Light Mode</button>
        <button onClick={() => onCompleteSetup(true)}>Dark Mode</button>
      </div>
    </div>
  );
}

function WelcomeScreen({ darkMode, setDarkMode, onCreateNew, onOpenStoryboard, onContinue, onOpenRecent }) {
  const userName = getUserName();
  const [recentStoryboards, setRecentStoryboards] = useState([]);

  useEffect(() => {
    getAllFromIndexedDB().then((data) => {
      if (data) setRecentStoryboards(data);
    });
  }, []);

  return (
    <div className={`welcome-screen ${darkMode ? 'dark' : 'light'}`}>
      <div className="welcome-topbar">
        <div className="topbar-left">
          <h2>Storyboard Creator</h2>
        </div>
        <div className="topbar-right">
          <button className="topbar-button" onClick={() => setDarkMode((prev) => !prev)}>
            {darkMode ? 'Light Mode' : 'Dark Mode'}
          </button>
        </div>
      </div>
      <div className="welcome-content">
        <h1 className="welcome-title">Welcome, {userName}</h1>
        <p className="welcome-subtitle">Get started on your next storyboard</p>
        <div className="welcome-actions">
          <button className="action-button" onClick={onCreateNew}>
            New Storyboard
          </button>
          <label htmlFor="openFileWelcome" className="action-button">
            Open Storyboard
          </label>
          <input id="openFileWelcome" type="file" accept=".json" onChange={onOpenStoryboard} style={{ display: 'none' }} />
          <button className="action-button" onClick={onContinue}>
            Continue to Editor
          </button>
        </div>
        {recentStoryboards.length > 0 && (
          <div className="welcome-recent-files">
            <h3>Recently Opened</h3>
            <ul>
              {recentStoryboards.map((sb) => (
                <li key={sb.id} onClick={() => onOpenRecent(sb)}>
                  {sb.name}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
