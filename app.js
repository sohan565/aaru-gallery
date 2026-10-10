/* ==========================================================================
   Romantic Photo Gallery - Curation Engine & Logic (app.js)
   Integrated with Google Drive CDN & Google Sheet Sync
   ========================================================================== */

(function () {
  'use strict';

  // --- CONFIGURATION & CONSTANTS ---
  const STORAGE_KEY = 'her_curated_memories_v2';
  const CONFIG_KEY = 'her_gallery_config_v3';

  let allPhotos = [];             // Complete array of photo objects
  let filteredPhotos = [];        // Filtered array based on active tab & search
  let currentIndex = 0;           // Current index in Curate/Swipe mode
  let historyStack = [];          // Stack of photo IDs for undo action
  let activeFilter = 'all';       // 'all', 'loved', 'super', 'unreviewed', 'passed'
  let activeSort = 'original';    // 'original', 'name', 'random', 'recently-rated'
  let currentGridBatch = 0;       // For chunked infinite scrolling in Grid view
  const BATCH_SIZE = 20;          // Load 20 items at a time for smooth 60fps scrolling on mobile
  let isPageVisible = true;       // Page visibility tracking for perf
  let statsDebounceTimer = null;  // Debounce timer for updateStats
  let currentLightboxId = null;   // Active photo in Lightbox
  let audioContext = null;        // Web Audio API for lofi ambient sound & chimes
  let isMusicPlaying = false;
  let musicInterval = null;
  let driveSyncTimeout = null;

  // Personalization State
  let appConfig = {
    herName: 'Aaru 💕',
    loveLetter: "tu humesha jhagadti na ki mere choice ke photos tko psnd nai aate par sach ye hai ki literally har photo me tu sundar lgti har angle me meko tu apsara jaisi lgti...you look soo breathtaking in evry single one of these 1732 memories..but since humari maharanni ko meri choice nai psnd aati, this place is yours to go through them and choose the ones you actually love. Take your time, my love! 💕",
    signature: '— With all my love, Chotu✨',
    whispers: [
      'Reminder: You look 10/10 in all 1,732 of these, no debate! 🌸',
      'Even your candid funny faces are my absolute favorite 🥹',
      'Take your time, my love! Your picks will become our photo album 📖',
      'Warning: Extremely high cuteness levels detected ⚠️💖',
      'Every smile of yours is my favorite work of art ✨',
      'Can we frame this entire gallery on the wall? 🥰'
    ]
  };

  // DOM Elements
  const els = {
    ambientCanvas: document.getElementById('ambientCanvas'),
    heartSparkleBtn: document.getElementById('heartSparkleBtn'),
    personalizedSubtext: document.getElementById('personalizedSubtext'),
    loveLetterDisplay: document.getElementById('loveLetterDisplay'),
    senderSignature: document.getElementById('senderSignature'),
    whisperText: document.getElementById('whisperText'),
    randomWhisper: document.getElementById('randomWhisper'),
    ambientMusicToggle: document.getElementById('ambientMusicToggle'),
    musicLabel: document.getElementById('musicLabel'),
    editGreetingBtn: document.getElementById('editGreetingBtn'),
    openExportBtn: document.getElementById('openExportBtn'),
    headerFavoriteCount: document.getElementById('headerFavoriteCount'),
    sheetSyncStatusBadge: document.getElementById('sheetSyncStatusBadge'),
    sheetSyncIcon: document.getElementById('sheetSyncIcon'),
    sheetSyncText: document.getElementById('sheetSyncText'),
    // Progress
    progressPercentage: document.getElementById('progressPercentage'),
    progressFraction: document.getElementById('progressFraction'),
    progressFill: document.getElementById('progressFill'),
    pillAll: document.getElementById('pillAll'),
    pillLoved: document.getElementById('pillLoved'),
    pillSuper: document.getElementById('pillSuper'),
    pillUnreviewed: document.getElementById('pillUnreviewed'),
    pillPassed: document.getElementById('pillPassed'),
    countAll: document.getElementById('countAll'),
    countLoved: document.getElementById('countLoved'),
    countSuper: document.getElementById('countSuper'),
    countUnreviewed: document.getElementById('countUnreviewed'),
    countPassed: document.getElementById('countPassed'),
    // Source Toolbar
    sourceStatusText: document.getElementById('sourceStatusText'),
    sourceIcon: document.getElementById('sourceIcon'),
    folderPickerInput: document.getElementById('folderPickerInput'),
    filePickerInput: document.getElementById('filePickerInput'),
    syncDriveBtn: document.getElementById('syncDriveBtn'),
    loadFolderBtn: document.getElementById('loadFolderBtn'),
    loadFilesBtn: document.getElementById('loadFilesBtn'),
    loadDemoBtn: document.getElementById('loadDemoBtn'),
    // Mode Switcher
    modeTinderBtn: document.getElementById('modeTinderBtn'),
    modeGridBtn: document.getElementById('modeGridBtn'),
    curateSection: document.getElementById('curateSection'),
    gridSection: document.getElementById('gridSection'),
    photoSearchInput: document.getElementById('photoSearchInput'),
    clearSearchBtn: document.getElementById('clearSearchBtn'),
    sortSelect: document.getElementById('sortSelect'),
    gridSizeControls: document.getElementById('gridSizeControls'),
    // Curate Card (Swipe Mode)
    cardStack: document.getElementById('cardStack'),
    currentCurateCard: document.getElementById('currentCurateCard'),
    cardImage: document.getElementById('cardImage'),
    cardVideo: document.getElementById('cardVideo'),
    cardSpinner: document.getElementById('cardSpinner'),
    stampPass: document.getElementById('stampPass'),
    stampLove: document.getElementById('stampLove'),
    stampSuper: document.getElementById('stampSuper'),
    cardNumberBadge: document.getElementById('cardNumberBadge'),
    cardPhotoName: document.getElementById('cardPhotoName'),
    cardPhotoMeta: document.getElementById('cardPhotoMeta'),
    cardHashMeta: document.getElementById('cardHashMeta'),
    cardStatusBadge: document.getElementById('cardStatusBadge'),
    cardStatusText: document.getElementById('cardStatusText'),
    cardNoteInput: document.getElementById('cardNoteInput'),
    btnUndo: document.getElementById('btnUndo'),
    btnPass: document.getElementById('btnPass'),
    btnSuper: document.getElementById('btnSuper'),
    btnLove: document.getElementById('btnLove'),
    btnExpand: document.getElementById('btnExpand'),
    emptyCurateState: document.getElementById('emptyCurateState'),
    emptyExportBtn: document.getElementById('emptyExportBtn'),
    emptyResetBtn: document.getElementById('emptyResetBtn'),
    // Grid
    photosGrid: document.getElementById('photosGrid'),
    activeFilterLabel: document.getElementById('activeFilterLabel'),
    gridFilteredCount: document.getElementById('gridFilteredCount'),
    scrollSentinel: document.getElementById('scrollSentinel'),
    loadingMorePill: document.getElementById('loadingMorePill'),
    emptyGridState: document.getElementById('emptyGridState'),
    resetFiltersBtn: document.getElementById('resetFiltersBtn'),
    selectAllFilteredBtn: document.getElementById('selectAllFilteredBtn'),
    clearFilteredBtn: document.getElementById('clearFilteredBtn'),
    // Lightbox
    lightboxModal: document.getElementById('lightboxModal'),
    lightboxBackdrop: document.getElementById('lightboxBackdrop'),
    closeLightboxBtn: document.getElementById('closeLightboxBtn'),
    lightboxImage: document.getElementById('lightboxImage'),
    lightboxVideo: document.getElementById('lightboxVideo'),
    lbPrevBtn: document.getElementById('lbPrevBtn'),
    lbNextBtn: document.getElementById('lbNextBtn'),
    lbPhotoNumber: document.getElementById('lbPhotoNumber'),
    lbPhotoTitle: document.getElementById('lbPhotoTitle'),
    lbPhotoMeta: document.getElementById('lbPhotoMeta'),
    lbPhotoHash: document.getElementById('lbPhotoHash'),
    lbBtnLoved: document.getElementById('lbBtnLoved'),
    lbBtnSuper: document.getElementById('lbBtnSuper'),
    lbBtnPass: document.getElementById('lbBtnPass'),
    lbStickers: document.getElementById('lbStickers'),
    lbNoteInput: document.getElementById('lbNoteInput'),
    lbDownloadBtn: document.getElementById('lbDownloadBtn'),
    // Export Hub
    exportModal: document.getElementById('exportModal'),
    exportBackdrop: document.getElementById('exportBackdrop'),
    closeExportBtn: document.getElementById('closeExportBtn'),
    exportLovedCount: document.getElementById('exportLovedCount'),
    exportSuperCount: document.getElementById('exportSuperCount'),
    exportTotalCount: document.getElementById('exportTotalCount'),
    copyFilenamesBtn: document.getElementById('copyFilenamesBtn'),
    saveToServerBtn: document.getElementById('saveToServerBtn'),
    saveToSheetBtn: document.getElementById('saveToSheetBtn'),
    downloadZipBtn: document.getElementById('downloadZipBtn'),
    zipBtnIcon: document.getElementById('zipBtnIcon'),
    zipBtnText: document.getElementById('zipBtnText'),
    downloadJsonBtn: document.getElementById('downloadJsonBtn'),
    togglePicksPreviewBtn: document.getElementById('togglePicksPreviewBtn'),
    picksPreviewContainer: document.getElementById('picksPreviewContainer'),
    picksPreviewText: document.getElementById('picksPreviewText'),
    gfLoveNoteInput: document.getElementById('gfLoveNoteInput'),
    // Personalize
    personalizeModal: document.getElementById('personalizeModal'),
    personalizeBackdrop: document.getElementById('personalizeBackdrop'),
    closePersonalizeBtn: document.getElementById('closePersonalizeBtn'),
    inputHerName: document.getElementById('inputHerName'),
    inputLoveLetter: document.getElementById('inputLoveLetter'),
    inputSignature: document.getElementById('inputSignature'),
    saveGreetingBtn: document.getElementById('saveGreetingBtn'),
    resetGreetingBtn: document.getElementById('resetGreetingBtn'),
    toastContainer: document.getElementById('toastContainer'),
    shortcutHelpLink: document.getElementById('shortcutHelpLink'),
    // Story Slideshow
    openStoryBtn: document.getElementById('openStoryBtn'),
    storyModal: document.getElementById('storyModal'),
    storyBackdrop: document.getElementById('storyBackdrop'),
    closeStoryBtn: document.getElementById('closeStoryBtn'),
    storyProgressBars: document.getElementById('storyProgressBars'),
    storyPhotoTitle: document.getElementById('storyPhotoTitle'),
    storyPhotoSub: document.getElementById('storyPhotoSub'),
    storyPlayPauseBtn: document.getElementById('storyPlayPauseBtn'),
    storyMediaWrapper: document.getElementById('storyMediaWrapper'),
    storyImage: document.getElementById('storyImage'),
    storyVideo: document.getElementById('storyVideo'),
    storyTapLeft: document.getElementById('storyTapLeft'),
    storyTapRight: document.getElementById('storyTapRight'),
    storyBadgePill: document.getElementById('storyBadgePill'),
    storyNoteText: document.getElementById('storyNoteText'),
    // Quick Unreviewed Filter Toggle
    quickUnreviewedToggle: document.getElementById('quickUnreviewedToggle'),
    unreviewedToggleText: document.getElementById('unreviewedToggleText'),
    // Milestone Note
    milestoneModal: document.getElementById('milestoneModal'),
    milestoneBackdrop: document.getElementById('milestoneBackdrop'),
    milestoneIcon: document.getElementById('milestoneIcon'),
    milestoneTitle: document.getElementById('milestoneTitle'),
    milestoneCountPill: document.getElementById('milestoneCountPill'),
    milestoneMessageText: document.getElementById('milestoneMessageText'),
    milestoneContinueBtn: document.getElementById('milestoneContinueBtn')
  };

  // --- INITIALIZATION ---
  async function init() {
    loadSavedConfig();
    setupAmbientCanvas();
    setupEventListeners();
    setupIntersectionObserver();
    setupImageLazyObserver();
    setupPageVisibility();
    setupLightboxZoom();
    renderWhisper();

    // 1. Check local server (streams 1,732 photos directly from disk with ZERO rate limits!)
    const foundLocal = await checkServerPhotos();
    if (!foundLocal) {
      // 2. Fallback to gallery_data.json
      const loadedFromDrive = await loadGalleryData();
      if (!loadedFromDrive) {
        showToast('☁️ Ready to load your 1,732 memories!');
      }
    }
  }


  // --- PAGE VISIBILITY (pause heavy work when tab is hidden) ---
  function setupPageVisibility() {
    document.addEventListener('visibilitychange', () => {
      isPageVisible = !document.hidden;
    });
  }

  // --- DATA LOADING & DRIVE SYNC ---
  async function loadGalleryData() {
    try {
      const resp = await fetch('gallery_data.json');
      if (resp.ok) {
        const data = await resp.json();
        if (Array.isArray(data) && data.length > 0) {
          loadPhotos(data, 'gdrive');
          showToast(`☁️ Loaded ${data.length.toLocaleString()} memories directly from Google Drive! 💕`);
          return true;
        }
      }
    } catch (e) {
      console.warn('Could not load gallery_data.json', e);
    }
    return false;
  }

  async function syncLiveWithGoogleDrive() {
    showToast('☁️ Fetching latest photos from Google Drive...');
    els.syncDriveBtn.disabled = true;

    try {
      const resp = await fetch(APPS_SCRIPT_URL);
      if (resp.ok) {
        const driveFiles = await resp.json();
        if (Array.isArray(driveFiles) && driveFiles.length > 0) {
          // Merge with current photos or reload
          const formatted = driveFiles.map((df, index) => {
            const num = index + 1;
            const isVideo = (df.name || '').toLowerCase().endsWith('.mp4');
            return {
              number: num,
              displayNumber: `#${String(num).padStart(4, '0')}`,
              hash: `drive_${df.id.substring(0, 16)}`,
              name: df.name,
              isVideo: isVideo,
              driveId: df.id,
              url: isVideo ? `https://drive.google.com/file/d/${df.id}/preview` : `https://lh3.googleusercontent.com/d/${df.id}=w2000`,
              thumbUrl: isVideo ? `https://drive.google.com/thumbnail?id=${df.id}&sz=w600` : `https://lh3.googleusercontent.com/d/${df.id}=w600`,
              status: 'unreviewed',
              sticker: '',
              note: ''
            };
          });

          loadPhotos(formatted, 'gdrive');
          showToast(`🎉 Synced ${driveFiles.length} files from Google Drive!`);
          triggerConfetti();
        }
      }
    } catch (err) {
      console.error(err);
      showToast('⚠️ Google Drive sync issue. Loading local data...');
      loadGalleryData();
    } finally {
      els.syncDriveBtn.disabled = false;
    }
  }

  async function checkServerPhotos() {
    try {
      const resp = await fetch('/api/photos');
      if (resp.ok) {
        const data = await resp.json();
        if (data && data.photos && data.photos.length > 0) {
          loadPhotos(data.photos, 'server');
          showToast(`💖 Loaded ${data.photos.length.toLocaleString()} photos!`);
          return true;
        }
      }
    } catch (e) {}
    return false;
  }

  function loadPhotos(photoList, sourceName = 'gdrive') {
    allPhotos = photoList.map((item, index) => {
      const num = item.number || (index + 1);
      const isVideo = item.isVideo || (item.name || '').toLowerCase().endsWith('.mp4');
      const hash = item.hash || `hash_${String(num).padStart(4, '0')}`;
      const dispNum = item.displayNumber || `#${String(num).padStart(4, '0')}`;

      return {
        id: item.id || `photo-${num}-${encodeURIComponent(item.name || 'img')}`,
        number: num,
        displayNumber: dispNum,
        hash: hash,
        name: item.name || `Memory_${num}.jpg`,
        isVideo: isVideo,
        driveId: item.driveId || '',
        url: item.url || (item.file ? URL.createObjectURL(item.file) : ''),
        thumbUrl: item.thumbUrl || item.url || '',
        file: item.file || null,
        status: item.status || 'unreviewed',
        sticker: item.sticker || '',
        note: item.note || '',
        timestamp: item.timestamp || null
      };
    });

    loadSavedRatings();
    currentIndex = findNextUnreviewedIndex(0);
    applyFilters();
    updateStats();

    els.sourceIcon.textContent = sourceName === 'gdrive' ? '☁️' : sourceName === 'server' ? '📁' : '📂';
    els.sourceStatusText.textContent = `Loaded ${allPhotos.length.toLocaleString()} memories (${sourceName === 'gdrive' ? 'Google Drive Cloud' : 'Local folder'})`;

    renderCurateCard();
    renderGridBatch(true);
  }

  // --- CONFIG & PERSISTENCE ---
  function loadSavedConfig() {
    try {
      const savedConfig = localStorage.getItem(CONFIG_KEY);
      if (savedConfig) {
        appConfig = Object.assign(appConfig, JSON.parse(savedConfig));
      }
    } catch (e) {}
    applyConfigUI();
  }

  function applyConfigUI() {
    els.personalizedSubtext.textContent = `A Special Space For ${appConfig.herName}`;
    els.loveLetterDisplay.textContent = appConfig.loveLetter;
    els.senderSignature.textContent = appConfig.signature;
  }

  function saveConfig() {
    try {
      localStorage.setItem(CONFIG_KEY, JSON.stringify(appConfig));
    } catch (e) {}
    applyConfigUI();
  }

  // Helper to update the visual sync badge in the top navigation bar
  function setSheetSyncBadgeState(state, text) {
    if (!els.sheetSyncStatusBadge) return;
    els.sheetSyncStatusBadge.classList.remove('syncing', 'synced', 'error');
    if (state === 'syncing') {
      els.sheetSyncStatusBadge.classList.add('syncing');
      if (els.sheetSyncIcon) els.sheetSyncIcon.textContent = '🔄';
    } else if (state === 'synced') {
      els.sheetSyncStatusBadge.classList.add('synced');
      if (els.sheetSyncIcon) els.sheetSyncIcon.textContent = '☁️';
    } else if (state === 'error') {
      els.sheetSyncStatusBadge.classList.add('error');
      if (els.sheetSyncIcon) els.sheetSyncIcon.textContent = '⚠️';
    }
    if (els.sheetSyncText && text) {
      els.sheetSyncText.textContent = text;
    }
  }

  // Pure Cloudflare KV Sync: Single Source of Truth
  async function loadSavedRatings() {
    setSheetSyncBadgeState('syncing', 'Connecting to Cloudflare KV...');
    let loadedPicks = [];

    // 1. Fetch live selections from Cloudflare KV endpoint
    try {
      const res = await fetch('/api/selections', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.picks) && data.picks.length > 0) {
          loadedPicks = data.picks;
        }
      }
    } catch (e) {
      console.warn('Could not fetch from /api/selections', e);
    }

    // Apply selections onto gallery photos
    if (loadedPicks.length > 0) {
      let matchCount = 0;
      loadedPicks.forEach(sp => {
        const photo = allPhotos.find(p => 
          (sp.displayNumber && p.displayNumber.trim() === String(sp.displayNumber).trim()) ||
          (sp.name && p.name.toLowerCase().trim() === String(sp.name).toLowerCase().trim())
        );
        if (photo) {
          photo.status = sp.status || 'unreviewed';
          photo.sticker = sp.sticker || '';
          photo.note = sp.note || '';
          matchCount++;
        }
      });

      updateStats();
      applyFilters();
      renderCurateCard();
      setSheetSyncBadgeState('synced', `Cloudflare Synced (${matchCount} picks)`);
      showToast(`⚡ Loaded ${matchCount} choices live from Cloudflare KV! 💕`);
    } else {
      setSheetSyncBadgeState('synced', 'Cloudflare Sync Active');
    }
  }

  // Real-time rating change trigger: debounced live sync
  function saveRatings() {
    debouncedUpdateStats();
    scheduleRealtimeSheetSync();
  }

  function debouncedUpdateStats() {
    clearTimeout(statsDebounceTimer);
    statsDebounceTimer = setTimeout(updateStats, 150);
  }

  let realtimeSyncTimeout = null;
  function scheduleRealtimeSheetSync() {
    clearTimeout(realtimeSyncTimeout);
    setSheetSyncBadgeState('syncing', 'Syncing to Cloudflare...');
    realtimeSyncTimeout = setTimeout(() => {
      syncRealtimeToCloudflareKV(false);
    }, 300);
  }

  // Pushes reviewed memories to Cloudflare KV in real time (unliked photos are automatically excluded)
  async function syncRealtimeToCloudflareKV(notify = false) {
    const reviewed = allPhotos.filter(p => p.status !== 'unreviewed' || p.note || p.sticker);

    const payload = {
      updatedAt: new Date().toISOString(),
      timestamp: new Date().toISOString(),
      gfNote: els.gfLoveNoteInput ? els.gfLoveNoteInput.value.trim() : '',
      totalPicked: reviewed.length,
      totalReviewed: reviewed.length,
      picks: reviewed.map(f => ({
        displayNumber: f.displayNumber,
        number: f.number,
        name: f.name,
        status: f.status,
        sticker: f.sticker || '',
        note: f.note || ''
      }))
    };

    try {
      const res = await fetch('/api/save-selections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setSheetSyncBadgeState('synced', `Cloudflare Synced (${reviewed.length})`);
        if (notify) {
          showToast(`⚡ Successfully synced ${reviewed.length} picks to Cloudflare KV!`);
          triggerConfetti();
        }
      } else {
        setSheetSyncBadgeState('error', 'Sync Failed');
      }
    } catch (e) {
      setSheetSyncBadgeState('error', 'Sync Error');
    }
  }

  // --- STATS & PROGRESS TRACKER ---
  function updateStats() {
    const total = allPhotos.length;
    let loved = 0;
    let superLoved = 0;
    let passed = 0;
    let unreviewed = 0;

    allPhotos.forEach(p => {
      if (p.status === 'loved') loved++;
      else if (p.status === 'super') superLoved++;
      else if (p.status === 'passed') passed++;
      else unreviewed++;
    });

    const reviewed = total - unreviewed;
    const percent = total > 0 ? Math.round((reviewed / total) * 100) : 0;

    els.progressPercentage.textContent = `${percent}%`;
    els.progressFraction.textContent = `${reviewed.toLocaleString()} / ${total.toLocaleString()} Reviewed`;
    els.progressFill.style.width = `${percent}%`;

    els.countAll.textContent = total.toLocaleString();
    els.countLoved.textContent = loved.toLocaleString();
    els.countSuper.textContent = superLoved.toLocaleString();
    els.countUnreviewed.textContent = unreviewed.toLocaleString();
    els.countPassed.textContent = passed.toLocaleString();

    const totalFavorites = loved + superLoved;
    els.headerFavoriteCount.textContent = totalFavorites.toLocaleString();

    els.exportLovedCount.textContent = loved.toLocaleString();
    els.exportSuperCount.textContent = superLoved.toLocaleString();
    els.exportTotalCount.textContent = totalFavorites.toLocaleString();
  }

  // --- FILTERING & SORTING ---
  function applyFilters() {
    const query = (els.photoSearchInput.value || '').trim().toLowerCase();

    filteredPhotos = allPhotos.filter(photo => {
      if (activeFilter === 'loved' && photo.status !== 'loved') return false;
      if (activeFilter === 'super' && photo.status !== 'super') return false;
      if (activeFilter === 'passed' && photo.status !== 'passed') return false;
      if (activeFilter === 'unreviewed' && photo.status !== 'unreviewed') return false;

      if (query) {
        const matchesName = photo.name.toLowerCase().includes(query);
        const matchesNum = (photo.displayNumber || '').toLowerCase().includes(query);
        const matchesHash = (photo.hash || '').toLowerCase().includes(query);
        const matchesNote = (photo.note || '').toLowerCase().includes(query);
        const matchesSticker = (photo.sticker || '').toLowerCase().includes(query);
        if (!matchesName && !matchesNum && !matchesHash && !matchesNote && !matchesSticker) return false;
      }
      return true;
    });

    if (activeSort === 'name') {
      filteredPhotos.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    } else if (activeSort === 'recently-rated') {
      filteredPhotos.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    } else if (activeSort === 'random') {
      filteredPhotos.sort(() => Math.random() - 0.5);
    }

    els.activeFilterLabel.textContent = formatFilterName(activeFilter);
    els.gridFilteredCount.textContent = `${filteredPhotos.length.toLocaleString()} items`;

    renderGridBatch(true);
  }

  function formatFilterName(filter) {
    switch (filter) {
      case 'loved': return 'Loved Photos 💖';
      case 'super': return 'Super Loved ⭐';
      case 'unreviewed': return 'Needs Review ⏳';
      case 'passed': return 'Skipped ❌';
      default: return 'All Photos';
    }
  }

  // --- MODE 1: CURATE / TINDER SWIPE MODE ---
  function findNextUnreviewedIndex(fromIndex = currentIndex) {
    if (allPhotos.length === 0) return 0;
    for (let i = fromIndex; i < allPhotos.length; i++) {
      if (allPhotos[i].status === 'unreviewed') return i;
    }
    for (let i = 0; i < fromIndex; i++) {
      if (allPhotos[i].status === 'unreviewed') return i;
    }
    return fromIndex < allPhotos.length ? fromIndex : 0;
  }

  function renderCurateCard() {
    if (allPhotos.length === 0) {
      els.cardStack.style.display = 'none';
      els.emptyCurateState.style.display = 'block';
      return;
    }

    const unreviewedLeft = allPhotos.filter(p => p.status === 'unreviewed').length;
    if (unreviewedLeft === 0) {
      els.cardStack.style.display = 'none';
      els.emptyCurateState.style.display = 'block';
      return;
    }

    els.cardStack.style.display = 'block';
    els.emptyCurateState.style.display = 'none';

    if (currentIndex >= allPhotos.length || allPhotos[currentIndex].status !== 'unreviewed') {
      currentIndex = findNextUnreviewedIndex(currentIndex);
    }

    const photo = allPhotos[currentIndex];
    if (!photo) return;

    resetCardTransforms();

    els.cardSpinner.style.display = 'flex';
    els.cardImage.style.opacity = '0';
    els.cardVideo.style.display = 'none';

    if (photo.isVideo) {
      els.cardImage.style.display = 'none';
      els.cardVideo.style.display = 'block';
      els.cardVideo.src = photo.url;
      els.cardSpinner.style.display = 'none';
    } else {
      els.cardVideo.style.display = 'none';
      els.cardImage.style.display = 'block';

      els.cardImage.onload = () => {
        els.cardSpinner.style.display = 'none';
        els.cardImage.style.opacity = '1';
      };
      els.cardImage.onerror = () => {
        const stage = parseInt(els.cardImage.dataset.failStage || '0', 10);
        if (stage === 0 && photo.driveId) {
          els.cardImage.dataset.failStage = '1';
          els.cardImage.src = `https://drive.usercontent.google.com/download?id=${photo.driveId}&export=view`;
        } else if (stage === 1 && photo.driveId) {
          els.cardImage.dataset.failStage = '2';
          els.cardImage.src = `https://drive.google.com/thumbnail?id=${photo.driveId}&sz=w1200`;
        } else {
          els.cardSpinner.style.display = 'none';
          els.cardImage.style.opacity = '1';
        }
      };
      els.cardImage.dataset.failStage = '0';
      els.cardImage.src = photo.thumbUrl || photo.url || `https://drive.usercontent.google.com/download?id=${photo.driveId}&export=view`;
      preloadNextThumbnails(currentIndex);
    }

    els.cardNumberBadge.textContent = `✨ Memory ${photo.displayNumber}`;
    els.cardPhotoName.textContent = photo.name;
    els.cardPhotoMeta.textContent = `Memory #${photo.number} of ${allPhotos.length.toLocaleString()}`;
    els.cardHashMeta.textContent = `MD5: ${photo.hash}`;
    els.cardNoteInput.value = photo.note || '';

    updateCurateStatusBadge(photo.status);
    updateStickerButtons(photo.sticker);
  }

  function preloadNextThumbnails(fromIdx) {
    let count = 0;
    for (let i = fromIdx + 1; i < allPhotos.length && count < 3; i++) {
      if (allPhotos[i].status === 'unreviewed' && allPhotos[i].thumbUrl) {
        const img = new Image();
        img.src = allPhotos[i].thumbUrl;
        count++;
      }
    }
  }

  function resetCardTransforms() {
    const card = els.currentCurateCard;
    if (!card) return;
    card.style.transform = '';
    card.style.transition = 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)';
    els.stampPass.classList.remove('visible');
    els.stampPass.style.opacity = '';
    els.stampLove.classList.remove('visible');
    els.stampLove.style.opacity = '';
    els.stampSuper.classList.remove('visible');
    els.stampSuper.style.opacity = '';
  }

  function setupCardTouchGestures() {
    const card = els.currentCurateCard;
    if (!card) return;

    let startX = 0;
    let startY = 0;
    let currentX = 0;
    let currentY = 0;
    let isDragging = false;
    let hasMoved = false;
    let hasVibratedRight = false;
    let hasVibratedLeft = false;
    let hasVibratedUp = false;

    // Use the media wrapper as the primary touch swipe target
    const target = card.querySelector('.card-media-wrapper') || card;

    target.addEventListener('pointerdown', (e) => {
      if (allPhotos.length === 0) return;
      if (e.target.closest('button, input, select, textarea, .reaction-sticker-btn, video')) return;

      isDragging = true;
      hasMoved = false;
      hasVibratedRight = false;
      hasVibratedLeft = false;
      hasVibratedUp = false;
      startX = e.clientX;
      startY = e.clientY;
      currentX = startX;
      currentY = startY;

      card.style.transition = 'none';
      if (target.setPointerCapture) {
        try { target.setPointerCapture(e.pointerId); } catch (_) {}
      }
    });

    target.addEventListener('pointermove', (e) => {
      if (!isDragging) return;
      currentX = e.clientX;
      currentY = e.clientY;

      const dx = currentX - startX;
      const dy = currentY - startY;

      if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
        hasMoved = true;
      }

      if (!hasMoved) return;

      // Rotate with drag
      const rotate = dx * 0.07;
      card.style.transform = `translate(${dx}px, ${dy}px) rotate(${rotate}deg)`;

      // Dynamic feedback stamps & subtle haptic buzz
      if (dx > 30) {
        const op = Math.min(1, (dx - 30) / 60);
        els.stampLove.style.opacity = op;
        els.stampLove.classList.add('visible');
        els.stampPass.style.opacity = '0';
        els.stampSuper.style.opacity = '0';
        if (dx > 65 && !hasVibratedRight) {
          if (navigator.vibrate) navigator.vibrate([15]);
          hasVibratedRight = true;
        }
      } else if (dx < -30) {
        const op = Math.min(1, (-dx - 30) / 60);
        els.stampPass.style.opacity = op;
        els.stampPass.classList.add('visible');
        els.stampLove.style.opacity = '0';
        els.stampSuper.style.opacity = '0';
        if (dx < -65 && !hasVibratedLeft) {
          if (navigator.vibrate) navigator.vibrate([15]);
          hasVibratedLeft = true;
        }
      } else if (dy < -40 && Math.abs(dx) < 40) {
        const op = Math.min(1, (-dy - 40) / 60);
        els.stampSuper.style.opacity = op;
        els.stampSuper.classList.add('visible');
        els.stampLove.style.opacity = '0';
        els.stampPass.style.opacity = '0';
        if (dy < -65 && !hasVibratedUp) {
          if (navigator.vibrate) navigator.vibrate([20]);
          hasVibratedUp = true;
        }
      } else {
        els.stampLove.style.opacity = '0';
        els.stampPass.style.opacity = '0';
        els.stampSuper.style.opacity = '0';
      }
    });

    const finishDrag = (e) => {
      if (!isDragging) return;
      isDragging = false;

      if (target.releasePointerCapture) {
        try { target.releasePointerCapture(e.pointerId); } catch (_) {}
      }

      const dx = currentX - startX;
      const dy = currentY - startY;

      if (!hasMoved) {
        resetCardTransforms();
        return;
      }

      // Swipe thresholds (65px for mobile responsiveness)
      if (dx > 65) {
        rateCurrentPhoto('loved');
      } else if (dx < -65) {
        rateCurrentPhoto('passed');
      } else if (dy < -70 && Math.abs(dx) < 55) {
        rateCurrentPhoto('super');
      } else {
        resetCardTransforms();
      }
    };

    target.addEventListener('pointerup', finishDrag);
    target.addEventListener('pointercancel', finishDrag);
  }


  function updateCurateStatusBadge(status) {
    els.cardStatusBadge.className = 'current-status-tag';
    if (status === 'loved') {
      els.cardStatusBadge.classList.add('status-loved');
      els.cardStatusText.textContent = 'Loved 💕';
    } else if (status === 'super') {
      els.cardStatusBadge.classList.add('status-super');
      els.cardStatusText.textContent = 'Super Loved ⭐';
    } else if (status === 'passed') {
      els.cardStatusBadge.classList.add('status-passed');
      els.cardStatusText.textContent = 'Skipped ❌';
    } else {
      els.cardStatusText.textContent = 'Unreviewed';
    }
  }

  function updateStickerButtons(activeSticker) {
    document.querySelectorAll('.reaction-sticker-btn').forEach(btn => {
      if (btn.getAttribute('data-reaction') === activeSticker) {
        btn.classList.add('selected');
      } else {
        btn.classList.remove('selected');
      }
    });
  }

  function rateCurrentPhoto(newStatus) {
    if (allPhotos.length === 0) return;
    const photo = allPhotos[currentIndex];
    if (!photo) return;

    photo.note = els.cardNoteInput.value.trim();
    photo.status = newStatus;
    photo.timestamp = Date.now();

    historyStack.push({ id: photo.id, prevStatus: 'unreviewed' });

    if (newStatus === 'loved') {
      els.stampLove.classList.add('visible');
      playChime('love');
      window.burstHearts(window.innerWidth / 2, window.innerHeight / 2, 12);
    } else if (newStatus === 'super') {
      els.stampSuper.classList.add('visible');
      playChime('super');
      triggerConfetti();
    } else if (newStatus === 'passed') {
      els.stampPass.classList.add('visible');
      playChime('pass');
    }

    saveRatings();
    checkMilestones();

    const card = els.currentCurateCard;
    card.style.transition = 'transform 0.28s ease, opacity 0.28s ease';
    if (newStatus === 'loved') {
      card.style.transform = 'translate(120%, -20px) rotate(22deg)';
    } else if (newStatus === 'super') {
      card.style.transform = 'translate(0, -120%) rotate(0deg) scale(1.1)';
    } else if (newStatus === 'passed') {
      card.style.transform = 'translate(-120%, -20px) rotate(-22deg)';
    }

    setTimeout(() => {
      currentIndex = findNextUnreviewedIndex(currentIndex + 1);
      renderCurateCard();
    }, 280);
  }

  function undoLastAction() {
    if (historyStack.length === 0) {
      showToast('ℹ️ Nothing to undo yet!');
      return;
    }
    const last = historyStack.pop();
    const photo = allPhotos.find(p => p.id === last.id);
    if (photo) {
      photo.status = last.prevStatus || 'unreviewed';
      saveRatings();
      currentIndex = allPhotos.indexOf(photo);
      renderCurateCard();
      if (navigator.vibrate) navigator.vibrate([20]);
      showToast(`↺ Restored "${photo.displayNumber}" for review`);
    }
  }


  // --- MODE 2: GALLERY GRID VIEW ---
  function renderGridBatch(reset = false) {
    if (reset) {
      currentGridBatch = 0;
      // Fast DOM clear instead of innerHTML = ''
      while (els.photosGrid.firstChild) {
        els.photosGrid.removeChild(els.photosGrid.firstChild);
      }
    }

    if (filteredPhotos.length === 0) {
      els.emptyGridState.style.display = 'block';
      els.scrollSentinel.style.display = 'none';
      return;
    }

    els.emptyGridState.style.display = 'none';
    els.scrollSentinel.style.display = 'flex';

    const start = currentGridBatch * BATCH_SIZE;
    const end = Math.min(start + BATCH_SIZE, filteredPhotos.length);
    const batch = filteredPhotos.slice(start, end);

    const fragment = document.createDocumentFragment();

    batch.forEach(photo => {
      const card = createGridCardElement(photo);
      fragment.appendChild(card);
    });

    els.photosGrid.appendChild(fragment);
    currentGridBatch++;

    if (end >= filteredPhotos.length) {
      els.loadingMorePill.style.display = 'none';
      els.scrollSentinel.style.display = 'none';
    } else {
      els.loadingMorePill.style.display = 'inline-flex';
    }
  }

  // --- TRUE LAZY IMAGE LOADING via IntersectionObserver ---
  let imageLazyObserver = null;
  function setupImageLazyObserver() {
    if (!('IntersectionObserver' in window)) return; // fallback: images load normally
    imageLazyObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          const realSrc = img.dataset.src;
          if (realSrc) {
            img.src = realSrc;
            img.removeAttribute('data-src');
          }
          imageLazyObserver.unobserve(img);
        }
      });
    }, {
      rootMargin: '200px 0px', // start loading 200px before visible
      threshold: 0.01
    });
  }

  function createGridCardElement(photo) {
    const div = document.createElement('div');
    div.className = 'grid-photo-card';
    div.setAttribute('data-id', photo.id);
    // GPU-accelerated containment for scroll performance
    div.style.contentVisibility = 'auto';
    div.style.containIntrinsicSize = '0 280px';

    // Build DOM with createElement instead of innerHTML for speed
    const thumbWrapper = document.createElement('div');
    thumbWrapper.className = 'grid-thumb-wrapper';

    // Status badge
    if (photo.status !== 'unreviewed') {
      const badge = document.createElement('span');
      badge.className = 'thumb-status-badge ' + photo.status;
      badge.textContent = photo.status === 'loved' ? 'Loved 💕' : photo.status === 'super' ? 'Super ⭐' : 'Passed ❌';
      thumbWrapper.appendChild(badge);
    }

    // Number tag
    const numTag = document.createElement('span');
    numTag.className = 'thumb-number-tag';
    numTag.textContent = photo.displayNumber;
    thumbWrapper.appendChild(numTag);

    // Quick action buttons
    const quickActions = document.createElement('div');
    quickActions.className = 'thumb-quick-actions';
    const heartBtn = document.createElement('button');
    heartBtn.className = 'quick-icon-btn' + (photo.status === 'loved' ? ' active-heart' : '');
    heartBtn.setAttribute('data-action', 'love');
    heartBtn.textContent = '❤️';
    const starBtn = document.createElement('button');
    starBtn.className = 'quick-icon-btn' + (photo.status === 'super' ? ' active-star' : '');
    starBtn.setAttribute('data-action', 'super');
    starBtn.textContent = '⭐';
    quickActions.appendChild(heartBtn);
    quickActions.appendChild(starBtn);
    thumbWrapper.appendChild(quickActions);

    // Video overlay
    if (photo.isVideo) {
      const videoIcon = document.createElement('div');
      videoIcon.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:2rem;z-index:1;';
      videoIcon.textContent = '🎬';
      thumbWrapper.appendChild(videoIcon);
    }

    // Image element - TRUE lazy: use a transparent placeholder, load real src via observer
    const thumbImg = document.createElement('img');
    thumbImg.className = 'grid-thumb-img';
    thumbImg.alt = photo.name;
    thumbImg.setAttribute('decoding', 'async'); // non-blocking decode
    // Use 1x1 transparent pixel as placeholder
    thumbImg.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    thumbImg.dataset.src = photo.thumbUrl; // real source for lazy observer
    
    if (photo.driveId) {
      thumbImg.dataset.driveId = photo.driveId;
      thumbImg.onerror = function() {
        const stage = parseInt(this.dataset.failStage || '0', 10);
        if (stage === 0 && this.dataset.driveId) {
          this.dataset.failStage = '1';
          this.src = `https://drive.usercontent.google.com/download?id=${this.dataset.driveId}&export=view`;
        }
      };
    }
    thumbWrapper.appendChild(thumbImg);

    // Register with lazy observer
    if (imageLazyObserver) {
      imageLazyObserver.observe(thumbImg);
    } else {
      // Fallback: load immediately
      thumbImg.src = photo.thumbUrl;
    }

    div.appendChild(thumbWrapper);

    // Card info
    const infoDiv = document.createElement('div');
    infoDiv.className = 'grid-card-info';
    const nameDiv = document.createElement('div');
    nameDiv.className = 'grid-photo-name';
    nameDiv.title = photo.name;
    nameDiv.textContent = photo.name;
    infoDiv.appendChild(nameDiv);
    const subDiv = document.createElement('div');
    subDiv.className = 'grid-photo-sub';
    const statusSpan = document.createElement('span');
    statusSpan.textContent = photo.status === 'unreviewed' ? 'Needs review' : photo.status;
    subDiv.appendChild(statusSpan);
    if (photo.sticker) {
      const stickerSpan = document.createElement('span');
      stickerSpan.className = 'grid-sticker-badge';
      stickerSpan.textContent = photo.sticker;
      subDiv.appendChild(stickerSpan);
    }
    infoDiv.appendChild(subDiv);
    div.appendChild(infoDiv);

    // Event delegation - single listener
    div.addEventListener('click', (e) => {
      const quickBtnEl = e.target.closest('.quick-icon-btn');
      if (quickBtnEl) {
        e.stopPropagation();
        const action = quickBtnEl.getAttribute('data-action');
        togglePhotoStatus(photo, action === 'love' ? 'loved' : 'super');
        refreshCardDOM(div, photo);
        return;
      }
      openLightbox(photo.id);
    });

    return div;
  }

  function togglePhotoStatus(photo, targetStatus) {
    photo.status = photo.status === targetStatus ? 'unreviewed' : targetStatus;
    photo.timestamp = Date.now();
    saveRatings();
    playChime(photo.status === 'loved' ? 'love' : photo.status === 'super' ? 'super' : 'pass');
  }

  function refreshCardDOM(cardEl, photo) {
    const thumbWrapper = cardEl.querySelector('.grid-thumb-wrapper');
    const existingBadge = thumbWrapper.querySelector('.thumb-status-badge');
    if (existingBadge) existingBadge.remove();

    if (photo.status === 'loved') {
      thumbWrapper.insertAdjacentHTML('afterbegin', `<span class="thumb-status-badge loved">Loved 💕</span>`);
    } else if (photo.status === 'super') {
      thumbWrapper.insertAdjacentHTML('afterbegin', `<span class="thumb-status-badge super">Super ⭐</span>`);
    } else if (photo.status === 'passed') {
      thumbWrapper.insertAdjacentHTML('afterbegin', `<span class="thumb-status-badge passed">Passed ❌</span>`);
    }

    const heartBtn = cardEl.querySelector('[data-action="love"]');
    const starBtn = cardEl.querySelector('[data-action="super"]');
    if (heartBtn) heartBtn.className = `quick-icon-btn ${photo.status === 'loved' ? 'active-heart' : ''}`;
    if (starBtn) starBtn.className = `quick-icon-btn ${photo.status === 'super' ? 'active-star' : ''}`;

    const subText = cardEl.querySelector('.grid-photo-sub span');
    if (subText) subText.textContent = photo.status === 'unreviewed' ? 'Needs review' : photo.status;
  }

  function setupIntersectionObserver() {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting && els.gridSection.style.display !== 'none') {
          renderGridBatch(false);
        }
      });
    }, { rootMargin: '300px' });

    observer.observe(els.scrollSentinel);
  }

  // --- LIGHTBOX ZOOM & FULLSCREEN LOGIC ---
  let lightboxZoom = 1;
  let lastTapTime = 0;
  let initialPinchDist = 0;

  function resetLightboxZoom() {
    lightboxZoom = 1;
    if (els.lightboxImage) {
      els.lightboxImage.classList.remove('zoomed');
      els.lightboxImage.style.transform = 'scale(1)';
    }
  }

  function setupLightboxZoom() {
    const img = els.lightboxImage;
    if (!img) return;

    // Double-tap zoom for mobile
    img.addEventListener('click', () => {
      const now = Date.now();
      if (now - lastTapTime < 320) {
        if (lightboxZoom === 1) {
          lightboxZoom = 2.2;
          img.classList.add('zoomed');
          img.style.transform = `scale(${lightboxZoom})`;
          if (navigator.vibrate) navigator.vibrate([15]);
        } else {
          resetLightboxZoom();
        }
      }
      lastTapTime = now;
    });

    const container = img.parentElement;
    if (!container) return;

    container.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        initialPinchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    }, { passive: true });

    container.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2 && initialPinchDist > 0) {
        const currentDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const factor = currentDist / initialPinchDist;
        lightboxZoom = Math.min(3.5, Math.max(1, factor));
        img.style.transform = `scale(${lightboxZoom})`;
      }
    }, { passive: true });

    container.addEventListener('touchend', (e) => {
      if (e.touches.length < 2) {
        initialPinchDist = 0;
        if (lightboxZoom < 1.1) {
          resetLightboxZoom();
        }
      }
    });
  }

  // --- LIGHTBOX MODAL ---
  function openLightbox(photoId) {
    currentLightboxId = photoId;
    const photo = allPhotos.find(p => p.id === photoId);
    if (!photo) return;

    resetLightboxZoom();

    if (photo.isVideo) {
      els.lightboxImage.style.display = 'none';
      els.lightboxVideo.style.display = 'block';
      els.lightboxVideo.src = photo.url;
    } else {
      els.lightboxVideo.style.display = 'none';
      els.lightboxImage.style.display = 'block';
      els.lightboxImage.onerror = () => {
        const stage = parseInt(els.lightboxImage.dataset.failStage || '0', 10);
        if (stage === 0 && photo.driveId) {
          els.lightboxImage.dataset.failStage = '1';
          els.lightboxImage.src = `https://drive.usercontent.google.com/download?id=${photo.driveId}&export=view`;
        } else if (stage === 1 && photo.driveId) {
          els.lightboxImage.dataset.failStage = '2';
          els.lightboxImage.src = `https://drive.google.com/thumbnail?id=${photo.driveId}&sz=w1600`;
        }
      };
      els.lightboxImage.dataset.failStage = '0';
      // Load compressed thumbnail first for instantaneous opening!
      els.lightboxImage.src = photo.thumbUrl || photo.url || `https://drive.usercontent.google.com/download?id=${photo.driveId}&export=view`;

      // Silently upgrade to full camera resolution in the background
      if (photo.url && photo.thumbUrl) {
        const fullImg = new Image();
        fullImg.src = photo.url;
        fullImg.onload = () => {
          if (currentLightboxId === photo.id) {
            els.lightboxImage.src = photo.url;
          }
        };
      }
    }

    els.lbPhotoNumber.textContent = `✨ Memory ${photo.displayNumber}`;
    els.lbPhotoTitle.textContent = photo.name;
    els.lbPhotoMeta.textContent = `Memory #${photo.number} of ${allPhotos.length.toLocaleString()}`;
    els.lbPhotoHash.textContent = `MD5: ${photo.hash}`;
    els.lbNoteInput.value = photo.note || '';

    updateLightboxRatingButtons(photo.status);
    updateLightboxStickers(photo.sticker);

    els.lightboxModal.classList.add('show');
  }

  function closeLightbox() {
    resetLightboxZoom();
    if (currentLightboxId) {
      const photo = allPhotos.find(p => p.id === currentLightboxId);
      if (photo) {
        photo.note = els.lbNoteInput.value.trim();
        saveRatings();
        applyFilters();
      }
    }
    if (els.lightboxVideo) {
      els.lightboxVideo.pause();
      els.lightboxVideo.src = '';
    }
    els.lightboxModal.classList.remove('show');
    currentLightboxId = null;
  }

  // --- CHOTU'S MILESTONE LOVE NOTES ---
  const MILESTONES = [
    { count: 10, title: "10 Memories Done! 🌸", text: "Look at you curating like a pro! Tu humesha bolti hai na ki mere choice ke photos tko psnd nai aate, but sach me har photo me tu apsara lagti hai! 💖", icon: "✨" },
    { count: 25, title: "25 Memories Picked! 💕", text: "25 memories down! Har angle me tu sach me breathtaking lagti hai... Chotu is loving every single choice you're making Maharanni! 🥰", icon: "💌" },
    { count: 50, title: "Half a Century! ⭐", text: "50 memories sorted! You have the sweetest smile in the entire universe. Can we frame all of these on our wall? 👑", icon: "🌸" },
    { count: 100, title: "100 Memories Milestone! 💯", text: "A century of our memories curated by the queen herself! Tu literally har picture me 10/10 lagti hai, no debate allowed! 💖✨", icon: "🎉" },
    { count: 250, title: "250 Memories Down! 💐", text: "250 memories! We're building the most precious photo album ever. Take your time my love, you look stunning in each one! 🥰", icon: "💎" },
    { count: 500, title: "500 Memories Milestone! 👑", text: "Half a thousand memories sorted! Looking at you never gets old for Chotu. Truly the most beautiful girl in the world! 💕", icon: "🌟" },
    { count: 1000, title: "1,000 Memories! Absolute Queen 💖", text: "1,000 memories reviewed! Thank you for curating our best moments. Every single smile of yours is my favorite work of art! ✨", icon: "👑" }
  ];

  function checkMilestones() {
    const reviewedCount = allPhotos.filter(p => p.status !== 'unreviewed').length;
    let celebrated = [];
    try {
      celebrated = JSON.parse(localStorage.getItem('her_celebrated_milestones') || '[]');
    } catch (_) {}

    const milestone = MILESTONES.find(m => reviewedCount >= m.count && !celebrated.includes(m.count));
    if (milestone) {
      celebrated.push(milestone.count);
      try {
        localStorage.setItem('her_celebrated_milestones', JSON.stringify(celebrated));
      } catch (_) {}
      showMilestoneModal(milestone, reviewedCount);
    }
  }

  function showMilestoneModal(milestone, totalCount) {
    if (!els.milestoneModal) return;
    els.milestoneIcon.textContent = milestone.icon;
    els.milestoneTitle.textContent = milestone.title;
    els.milestoneCountPill.textContent = `✨ ${totalCount} Memories Curated So Far ✨`;
    els.milestoneMessageText.textContent = `"${milestone.text}"`;
    els.milestoneModal.classList.add('show');
    triggerConfetti();
    playChime('super');
    if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
  }

  // --- MEMORIES STORY SLIDESHOW (INSTAGRAM STORIES STYLE) ---
  let storyItems = [];
  let currentStoryIndex = 0;
  let storyProgressTimer = null;
  let isStoryPaused = false;
  let storyStartTime = 0;
  const STORY_DURATION = 3500;

  function openStoryModal() {
    storyItems = allPhotos.filter(p => p.status === 'loved' || p.status === 'super');
    if (storyItems.length === 0) {
      showToast('💖 Pick some photos as "Loved" or "Super Love" first to watch your Memory Story!');
      return;
    }

    currentStoryIndex = 0;
    isStoryPaused = false;
    els.storyModal.classList.add('show');
    buildStoryProgressBars();
    playStoryItem(0);
  }

  function closeStoryModal() {
    clearInterval(storyProgressTimer);
    els.storyModal.classList.remove('show');
    if (els.storyVideo) {
      els.storyVideo.pause();
      els.storyVideo.src = '';
    }
  }

  function buildStoryProgressBars() {
    els.storyProgressBars.innerHTML = '';
    const count = Math.min(storyItems.length, 35);
    for (let i = 0; i < count; i++) {
      const seg = document.createElement('div');
      seg.className = 'story-progress-segment';
      seg.id = `storySeg-${i}`;
      const fill = document.createElement('div');
      fill.className = 'story-progress-fill';
      fill.id = `storyFill-${i}`;
      seg.appendChild(fill);
      els.storyProgressBars.appendChild(seg);
    }
  }

  function playStoryItem(idx) {
    if (idx < 0) idx = 0;
    if (idx >= storyItems.length) {
      closeStoryModal();
      showToast('🎉 You watched all your loved memories! Such stunning moments 💕');
      return;
    }

    currentStoryIndex = idx;
    clearInterval(storyProgressTimer);

    const item = storyItems[idx];
    if (els.storyPhotoTitle) els.storyPhotoTitle.textContent = item.displayNumber || item.name;
    if (els.storyPhotoSub) els.storyPhotoSub.textContent = `Memory ${idx + 1} of ${storyItems.length}`;

    if (item.sticker) {
      els.storyBadgePill.style.display = 'inline-block';
      els.storyBadgePill.textContent = item.sticker;
    } else {
      els.storyBadgePill.style.display = 'none';
    }

    if (item.note) {
      els.storyNoteText.style.display = 'block';
      els.storyNoteText.textContent = `"${item.note}"`;
    } else {
      els.storyNoteText.style.display = 'none';
    }

    // Media
    if (item.isVideo) {
      els.storyImage.style.display = 'none';
      els.storyVideo.style.display = 'block';
      els.storyVideo.src = item.url;
      els.storyVideo.play().catch(() => {});
    } else {
      els.storyVideo.style.display = 'none';
      els.storyImage.style.display = 'block';
      els.storyImage.src = item.thumbUrl || item.url;
    }

    // Update progress bars
    const count = Math.min(storyItems.length, 35);
    for (let i = 0; i < count; i++) {
      const seg = document.getElementById(`storySeg-${i}`);
      const fill = document.getElementById(`storyFill-${i}`);
      if (!seg || !fill) continue;
      if (i < idx) {
        seg.className = 'story-progress-segment completed';
        fill.style.width = '100%';
      } else if (i === idx) {
        seg.className = 'story-progress-segment';
        fill.style.width = '0%';
      } else {
        seg.className = 'story-progress-segment';
        fill.style.width = '0%';
      }
    }

    storyStartTime = Date.now();
    const currentFill = document.getElementById(`storyFill-${idx}`);

    storyProgressTimer = setInterval(() => {
      if (isStoryPaused) return;
      const elapsed = Date.now() - storyStartTime;
      const pct = Math.min(100, (elapsed / STORY_DURATION) * 100);
      if (currentFill) currentFill.style.width = `${pct}%`;
      if (elapsed >= STORY_DURATION) {
        clearInterval(storyProgressTimer);
        playStoryItem(currentStoryIndex + 1);
      }
    }, 50);
  }

  function pauseStory() {
    isStoryPaused = true;
    if (els.storyPlayPauseBtn) els.storyPlayPauseBtn.textContent = '▶️';
    if (els.storyVideo && els.storyVideo.style.display !== 'none') {
      els.storyVideo.pause();
    }
  }

  function resumeStory() {
    isStoryPaused = false;
    storyStartTime = Date.now() - (parseFloat(document.getElementById(`storyFill-${currentStoryIndex}`)?.style.width || '0') / 100 * STORY_DURATION);
    if (els.storyPlayPauseBtn) els.storyPlayPauseBtn.textContent = '⏸️';
    if (els.storyVideo && els.storyVideo.style.display !== 'none') {
      els.storyVideo.play().catch(() => {});
    }
  }

  // --- UNREVIEWED QUICK TOGGLE ---
  function toggleOnlyUnreviewed() {
    if (activeFilter === 'unreviewed') {
      activeFilter = 'all';
      if (els.quickUnreviewedToggle) els.quickUnreviewedToggle.classList.remove('active');
      document.querySelectorAll('.stat-pill').forEach(p => p.classList.remove('active'));
      els.pillAll.classList.add('active');
      showToast('📸 Showing all memories');
    } else {
      activeFilter = 'unreviewed';
      if (els.quickUnreviewedToggle) els.quickUnreviewedToggle.classList.add('active');
      document.querySelectorAll('.stat-pill').forEach(p => p.classList.remove('active'));
      els.pillUnreviewed.classList.add('active');
      showToast('⏳ Showing only memories needing review');
    }
    applyFilters();
    if (els.curateSection.style.display !== 'none') {
      currentIndex = findNextUnreviewedIndex(currentIndex);
      renderCurateCard();
    }
  }


  function updateLightboxRatingButtons(status) {
    els.lbBtnLoved.className = `lb-rate-btn ${status === 'loved' ? 'active-loved' : ''}`;
    els.lbBtnSuper.className = `lb-rate-btn ${status === 'super' ? 'active-super' : ''}`;
    els.lbBtnPass.className = `lb-rate-btn ${status === 'passed' ? 'active-passed' : ''}`;
  }

  function updateLightboxStickers(activeSticker) {
    document.querySelectorAll('.lb-sticker').forEach(btn => {
      if (btn.getAttribute('data-sticker') === activeSticker) {
        btn.classList.add('selected');
      } else {
        btn.classList.remove('selected');
      }
    });
  }

  function navigateLightbox(dir) {
    if (!currentLightboxId) return;
    const idx = allPhotos.findIndex(p => p.id === currentLightboxId);
    if (idx === -1) return;

    const nextIdx = (idx + dir + allPhotos.length) % allPhotos.length;
    openLightbox(allPhotos[nextIdx].id);
  }

  // --- EXPORT & COMPLETION CENTER ---
  function openExportModal() {
    updateStats();

    const favorites = allPhotos.filter(p => p.status === 'loved' || p.status === 'super');
    const filenames = favorites.map(p => `[${p.displayNumber}] ${p.name}`).join('\n');
    els.picksPreviewText.value = filenames || 'No memories picked as loved or super favorite yet!';

    els.exportModal.classList.add('show');
  }

  function closeExportModal() {
    els.exportModal.classList.remove('show');
  }

  function copyFilenamesToClipboard() {
    const favorites = allPhotos.filter(p => p.status === 'loved' || p.status === 'super');
    if (favorites.length === 0) {
      showToast('⚠️ No favorite memories selected yet to copy!');
      return;
    }

    const lines = favorites.map(p => `${p.displayNumber} - ${p.name}`).join('\n');
    const searchString = favorites.map(p => `"${p.name}"`).join(' OR ');
    const fullText = `=== AARU'S FAVORITE MEMORIES (${favorites.length} TOTAL) ===\n\nSearch query:\n${searchString}\n\nList:\n${lines}`;

    navigator.clipboard.writeText(fullText).then(() => {
      showToast(`📋 Copied ${favorites.length} filenames to clipboard!`);
    }).catch(() => {
      els.picksPreviewContainer.style.display = 'block';
    });
  }

  // --- AMBIENT SOUND (WEB AUDIO API) ---
  function initAudio() {
    if (!audioContext) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) audioContext = new AudioCtx();
    }
    if (audioContext && audioContext.state === 'suspended') {
      audioContext.resume();
    }
  }

  function playChime(type) {
    initAudio();
    if (!audioContext) return;
    const ctx = audioContext;
    const now = ctx.currentTime;

    if (type === 'love') {
      [698.46, 880.00].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);
        gain.gain.setValueAtTime(0.08, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.45);
      });
    } else if (type === 'super') {
      [523.25, 659.25, 783.99, 1046.50].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.06);
        gain.gain.setValueAtTime(0.1, now + idx * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.6);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.06);
        osc.stop(now + idx * 0.06 + 0.65);
      });
    } else if (type === 'pass') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(200, now + 0.15);
      gain.gain.setValueAtTime(0.03, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.16);
    }
  }

  function toggleAmbientMusic() {
    initAudio();
    if (!audioContext) return;

    if (isMusicPlaying) {
      clearInterval(musicInterval);
      isMusicPlaying = false;
      els.ambientMusicToggle.classList.remove('playing');
      els.ambientMusicToggle.classList.remove('btn-accent');
      els.musicLabel.textContent = 'Music: Off';
      showToast('🎵 Ambient music paused');
    } else {
      isMusicPlaying = true;
      els.ambientMusicToggle.classList.add('playing');
      els.ambientMusicToggle.classList.add('btn-accent');
      els.musicLabel.textContent = 'Music: Playing 💕';
      showToast('🎵 Playing gentle romantic chords & music box...');
      playLofiChordCycle();
      playMusicBoxMelody();
      musicInterval = setInterval(() => {
        playLofiChordCycle();
        setTimeout(playMusicBoxMelody, 1800);
      }, 4800);
    }
  }

  function playMusicBoxMelody() {
    if (!audioContext || !isMusicPlaying) return;
    const ctx = audioContext;
    const melodyNotes = [523.25, 659.25, 783.99, 880.00, 1046.50, 1174.66];
    const sequence = [
      melodyNotes[Math.floor(Math.random() * melodyNotes.length)],
      melodyNotes[Math.floor(Math.random() * melodyNotes.length)],
      melodyNotes[Math.floor(Math.random() * melodyNotes.length)]
    ];
    const now = ctx.currentTime;
    sequence.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.32);
      gain.gain.setValueAtTime(0.02, now + idx * 0.32);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.32 + 1.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.32);
      osc.stop(now + idx * 0.32 + 1.15);
    });
  }


  function playLofiChordCycle() {
    if (!audioContext || !isMusicPlaying) return;
    const ctx = audioContext;
    const chords = [
      [261.63, 329.63, 392.00, 493.88],
      [220.00, 261.63, 329.63, 392.00],
      [174.61, 220.00, 261.63, 329.63],
      [196.00, 246.94, 293.66, 349.23]
    ];
    const chord = chords[Math.floor(Math.random() * chords.length)];
    const now = ctx.currentTime;

    chord.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, now);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.05);

      gain.gain.setValueAtTime(0.001, now + idx * 0.05);
      gain.gain.linearRampToValueAtTime(0.025, now + idx * 0.05 + 0.6);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.05 + 4.2);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.05);
      osc.stop(now + idx * 0.05 + 4.5);
    });
  }

  // --- AMBIENT CANVAS (HEARTS & SPARKLES) ---
  function setupAmbientCanvas() {
    const canvas = els.ambientCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let width, height;
    let particles = [];
    let animFrameId = null;
    // Detect mobile for lighter particles
    const isMobile = window.innerWidth < 768;
    const MAX_AMBIENT_PARTICLES = isMobile ? 8 : 15; // Reduced from 30
    const MAX_BURST_PARTICLES = isMobile ? 6 : 15;

    function resize() {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    }
    resize();
    // Debounce resize to avoid layout thrashing
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(resize, 200);
    });

    const colors = ['#ff3b77', '#ff7597', '#c084fc', '#ffd166', '#f472b6'];

    function createParticle(x, y, isBurst = false) {
      return {
        x: x !== undefined ? x : Math.random() * width,
        y: y !== undefined ? y : height + Math.random() * 20,
        size: Math.random() * (isBurst ? 18 : 12) + (isBurst ? 10 : 6),
        speedY: isBurst ? -(Math.random() * 6 + 2) : -(Math.random() * 0.8 + 0.3),
        speedX: isBurst ? (Math.random() - 0.5) * 6 : (Math.random() - 0.5) * 0.5,
        opacity: Math.random() * 0.5 + 0.3,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.03,
        isHeart: Math.random() > 0.35,
        life: 1,
        decay: isBurst ? Math.random() * 0.015 + 0.008 : 0
      };
    }

    for (let i = 0; i < MAX_AMBIENT_PARTICLES; i++) {
      const p = createParticle();
      p.y = Math.random() * height;
      particles.push(p);
    }

    window.burstHearts = function(x, y, count = 20) {
      const px = x !== undefined ? x : width / 2;
      const py = y !== undefined ? y : height / 2;
      const burstCount = Math.min(count, MAX_BURST_PARTICLES);
      for (let i = 0; i < burstCount; i++) {
        particles.push(createParticle(px, py, true));
      }
    };

    function drawHeart(x, y, size, color, opacity, rotation) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.globalAlpha = opacity;
      ctx.fillStyle = color;
      ctx.beginPath();
      const topCurveHeight = size * 0.3;
      ctx.moveTo(0, topCurveHeight);
      ctx.bezierCurveTo(-size / 2, -size / 2, -size, topCurveHeight / 3, 0, size);
      ctx.bezierCurveTo(size, topCurveHeight / 3, size / 2, -size / 2, 0, topCurveHeight);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    function drawSparkle(x, y, size, color, opacity) {
      ctx.save();
      ctx.translate(x, y);
      ctx.globalAlpha = opacity;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    let lastFrameTime = 0;
    const TARGET_FPS = isMobile ? 24 : 30; // Cap FPS instead of running at 60
    const FRAME_INTERVAL = 1000 / TARGET_FPS;

    function animate(timestamp) {
      animFrameId = requestAnimationFrame(animate);

      // Skip frames if page hidden or not enough time elapsed
      if (!isPageVisible) return;
      if (timestamp - lastFrameTime < FRAME_INTERVAL) return;
      lastFrameTime = timestamp;

      ctx.clearRect(0, 0, width, height);
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.speedX;
        p.y += p.speedY;
        p.rotation += p.rotSpeed;

        if (p.decay) {
          p.life -= p.decay;
          p.opacity = p.life * 0.8;
          if (p.life <= 0) {
            particles.splice(i, 1);
            continue;
          }
        } else if (p.y < -30) {
          particles[i] = createParticle();
        }

        if (p.isHeart) {
          drawHeart(p.x, p.y, p.size, p.color, p.opacity, p.rotation);
        } else {
          drawSparkle(p.x, p.y, p.size, p.color, p.opacity);
        }
      }
    }
    requestAnimationFrame(animate);
  }

  // --- CELEBRATIONS & NOTIFICATIONS ---
  function triggerConfetti() {
    if (typeof confetti === 'function') {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#ff3b77', '#ffd166', '#c084fc', '#ffffff']
      });
    }
  }

  function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'cute-toast';
    toast.innerHTML = message;
    els.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 250);
    }, 3200);
  }

  function renderWhisper() {
    const whispers = appConfig.whispers;
    const random = whispers[Math.floor(Math.random() * whispers.length)];
    els.whisperText.textContent = random;
  }

  // --- EVENT LISTENERS ---
  function setupEventListeners() {
    // Mode Switch
    els.modeTinderBtn.addEventListener('click', () => {
      els.modeTinderBtn.classList.add('active');
      els.modeGridBtn.classList.remove('active');
      els.curateSection.style.display = 'flex';
      els.gridSection.style.display = 'none';
      els.gridSizeControls.style.display = 'none';
      renderCurateCard();
    });

    els.modeGridBtn.addEventListener('click', () => {
      els.modeGridBtn.classList.add('active');
      els.modeTinderBtn.classList.remove('active');
      els.curateSection.style.display = 'none';
      els.gridSection.style.display = 'flex';
      els.gridSizeControls.style.display = 'flex';
      applyFilters();
    });

    // Brand Sparkle
    els.heartSparkleBtn.addEventListener('click', () => {
      playChime('love');
      window.burstHearts(window.innerWidth / 2, window.innerHeight / 2, 25);
      showToast('💖 Aaru, you are loved beyond words!');
    });

    els.randomWhisper.addEventListener('click', renderWhisper);

    // Google Drive Sync button
    els.syncDriveBtn.addEventListener('click', syncLiveWithGoogleDrive);

    // Filter pills
    document.querySelectorAll('.stat-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.stat-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        activeFilter = pill.getAttribute('data-filter');
        applyFilters();
      });
    });

    // Search
    // Debounced search to avoid refiltering on every keystroke
    let searchDebounceTimer = null;
    els.photoSearchInput.addEventListener('input', () => {
      els.clearSearchBtn.style.display = els.photoSearchInput.value.length > 0 ? 'block' : 'none';
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(applyFilters, 250);
    });

    els.clearSearchBtn.addEventListener('click', () => {
      els.photoSearchInput.value = '';
      els.clearSearchBtn.style.display = 'none';
      applyFilters();
    });

    els.sortSelect.addEventListener('change', (e) => {
      activeSort = e.target.value;
      applyFilters();
    });

    // Grid size buttons
    document.querySelectorAll('.size-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const cols = btn.getAttribute('data-cols');
        els.photosGrid.className = `photos-grid ${cols}-grid`;
      });
    });

    // Curate Card Actions
    setupCardTouchGestures();
    els.btnLove.addEventListener('click', () => rateCurrentPhoto('loved'));
    els.btnSuper.addEventListener('click', () => rateCurrentPhoto('super'));
    els.btnPass.addEventListener('click', () => rateCurrentPhoto('passed'));
    els.btnUndo.addEventListener('click', undoLastAction);
    els.btnExpand.addEventListener('click', () => {
      if (allPhotos[currentIndex]) openLightbox(allPhotos[currentIndex].id);
    });

    // Reaction Stickers on Card
    document.querySelectorAll('.reaction-sticker-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const reaction = btn.getAttribute('data-reaction');
        const photo = allPhotos[currentIndex];
        if (photo) {
          photo.sticker = photo.sticker === reaction ? '' : reaction;
          updateStickerButtons(photo.sticker);
          saveRatings();
          playChime('love');
        }
      });
    });

    els.emptyExportBtn.addEventListener('click', openExportModal);
    els.emptyResetBtn.addEventListener('click', () => {
      currentIndex = 0;
      renderCurateCard();
    });

    els.resetFiltersBtn.addEventListener('click', () => {
      activeFilter = 'all';
      els.photoSearchInput.value = '';
      document.querySelectorAll('.stat-pill').forEach(p => p.classList.remove('active'));
      els.pillAll.classList.add('active');
      applyFilters();
    });

    els.selectAllFilteredBtn.addEventListener('click', () => {
      filteredPhotos.forEach(p => p.status = 'loved');
      saveRatings();
      applyFilters();
      showToast(`❤️ Set ${filteredPhotos.length} photos as Loved!`);
    });

    els.clearFilteredBtn.addEventListener('click', () => {
      if (confirm('Reset ratings for these filtered photos to unreviewed?')) {
        filteredPhotos.forEach(p => p.status = 'unreviewed');
        saveRatings();
        applyFilters();
        showToast('Reset photo ratings.');
      }
    });

    els.ambientMusicToggle.addEventListener('click', toggleAmbientMusic);

    // Lightbox Controls
    els.closeLightboxBtn.addEventListener('click', closeLightbox);
    els.lightboxBackdrop.addEventListener('click', closeLightbox);
    els.lbPrevBtn.addEventListener('click', () => navigateLightbox(-1));
    els.lbNextBtn.addEventListener('click', () => navigateLightbox(1));

    els.lbBtnLoved.addEventListener('click', () => {
      if (!currentLightboxId) return;
      const photo = allPhotos.find(p => p.id === currentLightboxId);
      if (photo) {
        photo.status = photo.status === 'loved' ? 'unreviewed' : 'loved';
        updateLightboxRatingButtons(photo.status);
        saveRatings();
        playChime('love');
      }
    });

    els.lbBtnSuper.addEventListener('click', () => {
      if (!currentLightboxId) return;
      const photo = allPhotos.find(p => p.id === currentLightboxId);
      if (photo) {
        photo.status = photo.status === 'super' ? 'unreviewed' : 'super';
        updateLightboxRatingButtons(photo.status);
        saveRatings();
        playChime('super');
      }
    });

    els.lbBtnPass.addEventListener('click', () => {
      if (!currentLightboxId) return;
      const photo = allPhotos.find(p => p.id === currentLightboxId);
      if (photo) {
        photo.status = photo.status === 'passed' ? 'unreviewed' : 'passed';
        updateLightboxRatingButtons(photo.status);
        saveRatings();
        playChime('pass');
      }
    });

    document.querySelectorAll('.lb-sticker').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!currentLightboxId) return;
        const photo = allPhotos.find(p => p.id === currentLightboxId);
        if (photo) {
          const sticker = btn.getAttribute('data-sticker');
          photo.sticker = photo.sticker === sticker ? '' : sticker;
          updateLightboxStickers(photo.sticker);
          saveRatings();
        }
      });
    });

    els.lbDownloadBtn.addEventListener('click', () => {
      if (!currentLightboxId) return;
      const photo = allPhotos.find(p => p.id === currentLightboxId);
      if (photo) {
        const a = document.createElement('a');
        a.href = photo.url;
        a.download = photo.name;
        a.target = '_blank';
        a.click();
      }
    });

    // Export Modal Controls
    els.openExportBtn.addEventListener('click', openExportModal);
    els.closeExportBtn.addEventListener('click', closeExportModal);
    els.exportBackdrop.addEventListener('click', closeExportModal);
    els.copyFilenamesBtn.addEventListener('click', copyFilenamesToClipboard);
    els.saveToServerBtn.addEventListener('click', () => syncRealtimeToCloudflareKV(true));
    els.saveToSheetBtn.addEventListener('click', () => syncRealtimeToCloudflareKV(true));
    els.downloadJsonBtn.addEventListener('click', () => {
      const data = {
        exportedAt: new Date().toISOString(),
        picks: allPhotos.filter(p => p.status !== 'unreviewed' || p.note || p.sticker)
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `aaru-selections-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('📄 Downloaded JSON backup!');
    });
    els.togglePicksPreviewBtn.addEventListener('click', () => {
      const isVisible = els.picksPreviewContainer.style.display !== 'none';
      els.picksPreviewContainer.style.display = isVisible ? 'none' : 'block';
    });

    // Personalize Modal
    els.editGreetingBtn.addEventListener('click', () => {
      els.inputHerName.value = appConfig.herName;
      els.inputLoveLetter.value = appConfig.loveLetter;
      els.inputSignature.value = appConfig.signature;
      els.personalizeModal.classList.add('show');
    });

    els.closePersonalizeBtn.addEventListener('click', () => els.personalizeModal.classList.remove('show'));
    els.personalizeBackdrop.addEventListener('click', () => els.personalizeModal.classList.remove('show'));

    els.saveGreetingBtn.addEventListener('click', () => {
      appConfig.herName = els.inputHerName.value.trim() || 'Aaru 💕';
      appConfig.loveLetter = els.inputLoveLetter.value.trim() || appConfig.loveLetter;
      appConfig.signature = els.inputSignature.value.trim() || appConfig.signature;
      saveConfig();
      els.personalizeModal.classList.remove('show');
      showToast('💖 Gallery personalized successfully!');
    });

    els.resetGreetingBtn.addEventListener('click', () => {
      appConfig.herName = 'Aaru 💕';
      saveConfig();
      els.personalizeModal.classList.remove('show');
      showToast('Reset to default.');
    });

    // Story Slideshow Controls
    if (els.openStoryBtn) els.openStoryBtn.addEventListener('click', openStoryModal);
    if (els.closeStoryBtn) els.closeStoryBtn.addEventListener('click', closeStoryModal);
    if (els.storyBackdrop) els.storyBackdrop.addEventListener('click', closeStoryModal);
    if (els.storyPlayPauseBtn) els.storyPlayPauseBtn.addEventListener('click', () => {
      if (isStoryPaused) resumeStory(); else pauseStory();
    });
    if (els.storyTapLeft) els.storyTapLeft.addEventListener('click', () => playStoryItem(currentStoryIndex - 1));
    if (els.storyTapRight) els.storyTapRight.addEventListener('click', () => playStoryItem(currentStoryIndex + 1));

    // Quick Unreviewed Filter Toggle
    if (els.quickUnreviewedToggle) els.quickUnreviewedToggle.addEventListener('click', toggleOnlyUnreviewed);

    // Milestone Modal Controls
    if (els.milestoneContinueBtn) els.milestoneContinueBtn.addEventListener('click', () => {
      els.milestoneModal.classList.remove('show');
    });
    if (els.milestoneBackdrop) els.milestoneBackdrop.addEventListener('click', () => {
      els.milestoneModal.classList.remove('show');
    });

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
        if (e.key === 'Escape') e.target.blur();
        return;
      }

      if (els.storyModal && els.storyModal.classList.contains('show')) {
        if (e.key === 'ArrowLeft') playStoryItem(currentStoryIndex - 1);
        else if (e.key === 'ArrowRight') playStoryItem(currentStoryIndex + 1);
        else if (e.key === ' ' || e.key.toLowerCase() === 'k') {
          e.preventDefault();
          if (isStoryPaused) resumeStory(); else pauseStory();
        } else if (e.key === 'Escape') closeStoryModal();
        return;
      }

      if (els.milestoneModal && els.milestoneModal.classList.contains('show') && e.key === 'Escape') {
        els.milestoneModal.classList.remove('show');
        return;
      }

      if (els.lightboxModal.classList.contains('show')) {
        if (e.key === 'ArrowLeft') navigateLightbox(-1);
        else if (e.key === 'ArrowRight') navigateLightbox(1);
        else if (e.key === 'Escape') closeLightbox();
        return;
      }

      if (els.exportModal.classList.contains('show') && e.key === 'Escape') {
        closeExportModal();
        return;
      }

      if (els.curateSection.style.display !== 'none') {
        if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') {
          rateCurrentPhoto('loved');
        } else if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') {
          rateCurrentPhoto('passed');
        } else if (e.key === 'ArrowUp' || e.key.toLowerCase() === 'w' || e.key === ' ') {
          e.preventDefault();
          rateCurrentPhoto('super');
        } else if (e.key === 'ArrowDown' || e.key.toLowerCase() === 'z') {
          undoLastAction();
        }
      }
    });
  }


  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
