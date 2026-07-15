/* ==========================================================================
   ROLLS-ROYCE INTERACTIVE CONCEPT SITE - CORE JAVASCRIPT CONTROLLER
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // --------------------------------------------------------------------------
    // 1. CONFIGURATION & STATE
    // --------------------------------------------------------------------------
    const canvas = document.getElementById('animation-canvas');
    const ctx = canvas.getContext('2d');
    const loadingScreen = document.getElementById('loading-screen');
    const loaderBar = document.getElementById('loader-bar');
    const loaderPercentage = document.getElementById('loader-percentage');
    const scrollContainer = document.getElementById('experience');
    const hotspotsOverlay = document.getElementById('hotspots-overlay');

    // Sequence details: counts matches actual directories inspected
    const sequenceConfig = [
        { folder: '1', count: 270, label: '01 — A LEGACY IN MOTION' },
        { folder: '2', count: 180, label: '02 — CRAFTSMANSHIP' },
        { folder: '3', count: 180, label: '03 — PRESENCE' },
        { folder: '4', count: 180, label: '04 — ENGINEERING' },
        { folder: '5', count: 180, label: '05 — THE EXPERIENCE' }
    ];

    // Generate numerically sorted frame path manifest
    const framePaths = [];
    sequenceConfig.forEach(seq => {
        for (let i = 1; i <= seq.count; i++) {
            // Format to match exact files like: ezgif-frame-001.jpg
            const padNum = String(i).padStart(3, '0');
            framePaths.push(`${seq.folder}/ezgif-frame-${padNum}.jpg`);
        }
    });

    const totalFrames = framePaths.length; // 990 total frames
    const loadedFrames = {}; // Image cache: index -> Image object
    
    // Animation rendering loop state
    let currentFrame = 0;
    let targetFrame = 0;
    let isAnimating = false;
    let activeSequence = 1;
    let initialPreloadComplete = false;
    let prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let reducedMotionTimer = null;

    // Define boundary checkpoints between folders for crossfading
    const boundaryTransitions = [
        { threshold: 269.5, prevEnd: 269, nextStart: 270 }, // Last of folder 1 (270) -> First of folder 2 (1)
        { threshold: 449.5, prevEnd: 449, nextStart: 450 }, // Last of folder 2 (180) -> First of folder 3 (1)
        { threshold: 629.5, prevEnd: 629, nextStart: 630 }, // Last of folder 3 (180) -> First of folder 4 (1)
        { threshold: 809.5, prevEnd: 809, nextStart: 810 }  // Last of folder 4 (180) -> First of folder 5 (1)
    ];

    // Floating coordinate hotspots configuration
    // (x, y) relative to source resolution 1280x720
    const hotspots = [
        // Sequence 2: Rear components detaching (frames 270 to 449)
        { name: 'boot', label: 'Boot & luggage compartment', startFrame: 310, endFrame: 370, x: 640, y: 260, align: 'bottom' },
        { name: 'taillight', label: 'Rear light assembly', startFrame: 290, endFrame: 350, x: 870, y: 380, align: 'right' },
        { name: 'bumper', label: 'Rear bumper structure', startFrame: 330, endFrame: 390, x: 640, y: 540, align: 'bottom' },
        { name: 'trim', label: 'Exterior chrome trim', startFrame: 280, endFrame: 340, x: 520, y: 300, align: 'left' },
        { name: 'bodywork', label: 'Crafted bodywork panels', startFrame: 300, endFrame: 360, x: 280, y: 360, align: 'left' },

        // Sequence 4: Front components detaching (frames 630 to 809)
        { name: 'engine', label: 'V12 Engine assembly', startFrame: 675, endFrame: 745, x: 640, y: 360, align: 'right' },
        { name: 'cooling', label: 'High-performance cooling', startFrame: 690, endFrame: 755, x: 640, y: 470, align: 'bottom' },
        { name: 'grille', label: 'Pantheon Front Grille', startFrame: 655, endFrame: 725, x: 640, y: 535, align: 'bottom' },
        { name: 'headlight', label: 'LED headlight assembly', startFrame: 645, endFrame: 710, x: 350, y: 420, align: 'left' },
        { name: 'dashboard', label: 'Crafted wood dashboard panel', startFrame: 715, endFrame: 780, x: 820, y: 310, align: 'right' },
        { name: 'frame', label: 'Aluminum spaceframe chassis', startFrame: 685, endFrame: 740, x: 480, y: 485, align: 'left' },
        { name: 'bonnet', label: 'Polished aluminum bonnet', startFrame: 635, endFrame: 700, x: 640, y: 200, align: 'bottom' },
        { name: 'airintake', label: 'Optimized air-intake system', startFrame: 665, endFrame: 720, x: 540, y: 320, align: 'left' }
    ];

    // --------------------------------------------------------------------------
    // 2. IMAGE PRELOADER (PROGRESSIVE & PRIORITY)
    // --------------------------------------------------------------------------
    
    // Core function to load a single image and cache it
    function loadImage(index) {
        if (loadedFrames[index]) return Promise.resolve(loadedFrames[index]);
        
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.src = framePaths[index];
            img.onload = () => {
                loadedFrames[index] = img;
                resolve(img);
            };
            img.onerror = () => {
                console.error(`Failed to load image at frame ${index}: ${framePaths[index]}`);
                reject();
            };
        });
    }

    // Load first frame immediately so canvas isn't empty
    loadImage(0).then(() => {
        resizeCanvas();
    });

    // Priority-preload Sequence 1 (frames 0 to 270) to start the experience
    function startPreloading() {
        const seq1Count = 270;
        let loadedCount = 0;

        // Populate loading bar
        function updateProgress() {
            const percentage = Math.round((loadedCount / seq1Count) * 100);
            loaderBar.style.width = `${percentage}%`;
            loaderPercentage.innerText = `${percentage}%`;
        }

        const promises = [];
        for (let i = 0; i < seq1Count; i++) {
            promises.push(
                loadImage(i)
                    .then(() => {
                        loadedCount++;
                        updateProgress();
                    })
                    .catch(() => {
                        // Keep going even if some fail
                        loadedCount++;
                        updateProgress();
                    })
            );
        }

        Promise.all(promises).then(() => {
            initialPreloadComplete = true;
            
            // Hide loading screen with a fade-out animation
            loadingScreen.classList.add('fade-out');
            
            // Trigger initial calculations
            resizeCanvas();
            handleScroll();
            
            // Start background preloading of remaining folders
            preloadBackgroundSequences();
        });
    }

    // Preload remaining sequences (folders 2, 3, 4, 5) progressively
    function preloadBackgroundSequences() {
        let index = 270; // Start right after Sequence 1
        const maxConcurrently = 3; // Keep parallel loads limited

        function loadNext() {
            if (index >= totalFrames) return;
            const currentToLoad = index++;
            loadImage(currentToLoad).finally(() => {
                loadNext();
            });
        }

        for (let i = 0; i < maxConcurrently; i++) {
            loadNext();
        }
    }

    // Prioritize loading frames surrounding the user's current view
    // (Crucial if user scrolls faster than background loader completes)
    function prioritizeSurroundingFrames(targetIndex) {
        const range = 15; // preload 15 frames ahead and behind
        const start = Math.max(0, Math.floor(targetIndex) - range);
        const end = Math.min(totalFrames - 1, Math.ceil(targetIndex) + range);

        for (let i = start; i <= end; i++) {
            if (!loadedFrames[i]) {
                loadImage(i).then(() => {
                    // Trigger redraw if user is still looking at this frame
                    if (Math.round(currentFrame) === i && !isAnimating) {
                        drawFrame();
                    }
                });
            }
        }
    }

    // --------------------------------------------------------------------------
    // 3. CANVAS DRAWING & RENDER ENGINE
    // --------------------------------------------------------------------------
    
    // Draw the image(s) onto the canvas, keeping styling contained (object-fit: contain)
    function drawImageContain(img, opacity = 1.0) {
        if (!img) return null;
        
        const canvasWidth = canvas.clientWidth;
        const canvasHeight = canvas.clientHeight;
        const imgWidth = 1280;
        const imgHeight = 720;
        
        const imgRatio = imgWidth / imgHeight;
        const canvasRatio = canvasWidth / canvasHeight;
        
        let destWidth, destHeight, offsetX, offsetY;
        
        if (canvasRatio > imgRatio) {
            // Viewport is wider than image (landscape padding on sides)
            destHeight = canvasHeight;
            destWidth = canvasHeight * imgRatio;
            offsetX = (canvasWidth - destWidth) / 2;
            offsetY = 0;
        } else {
            // Viewport is taller than image (portrait padding top/bottom)
            destWidth = canvasWidth;
            destHeight = canvasWidth / imgRatio;
            offsetX = 0;
            offsetY = (canvasHeight - destHeight) / 2;
        }
        
        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.drawImage(img, offsetX, offsetY, destWidth, destHeight);
        ctx.restore();
        
        // Return dimensions so hotspots can align accurately
        return { destWidth, destHeight, offsetX, offsetY };
    }

    // Main rendering manager: Decides whether to draw normally or blend transition crossfades
    function drawFrame() {
        if (prefersReducedMotion) {
            drawReducedMotionFrame();
            return;
        }

        const roundedIndex = Math.round(currentFrame);
        
        // Check if we are near any folder transition boundaries
        let activeBoundary = null;
        const fadeWidth = 5; // Blend spanning 10 frames around transition boundary
        
        for (const transition of boundaryTransitions) {
            if (Math.abs(currentFrame - transition.threshold) <= fadeWidth) {
                activeBoundary = transition;
                break;
            }
        }

        ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);

        if (activeBoundary) {
            // Render transition boundary crossfade
            const minVal = activeBoundary.threshold - fadeWidth;
            const maxVal = activeBoundary.threshold + fadeWidth;
            const alpha = (currentFrame - minVal) / (maxVal - minVal); // Linearly map 0 to 1

            const imgA = loadedFrames[activeBoundary.prevEnd];
            const imgB = loadedFrames[activeBoundary.nextStart];

            if (imgA && imgB) {
                // Both boundary frames cached: blend them
                const dimsA = drawImageContain(imgA, 1 - alpha);
                const dimsB = drawImageContain(imgB, alpha);
                
                // Position hotspots using the dimensions of the dominant image
                const dims = alpha > 0.5 ? dimsB : dimsA;
                if (dims) {
                    updateHotspots(roundedIndex, dims.destWidth, dims.destHeight, dims.offsetX, dims.offsetY);
                }
            } else {
                // Fallback: draw whichever is ready to prevent black/white flashes
                const fallbackImg = imgA || imgB || loadedFrames[roundedIndex];
                const dims = drawImageContain(fallbackImg, 1.0);
                if (dims) {
                    updateHotspots(roundedIndex, dims.destWidth, dims.destHeight, dims.offsetX, dims.offsetY);
                }
            }
        } else {
            // Render normal single frame
            const img = loadedFrames[roundedIndex];
            if (img) {
                const dims = drawImageContain(img, 1.0);
                if (dims) {
                    updateHotspots(roundedIndex, dims.destWidth, dims.destHeight, dims.offsetX, dims.offsetY);
                }
            } else {
                // Priority load the missing frame, showing previous frame in cache as fallback
                prioritizeSurroundingFrames(currentFrame);
                let fallbackIdx = roundedIndex;
                while (fallbackIdx >= 0 && !loadedFrames[fallbackIdx]) {
                    fallbackIdx--;
                }
                if (fallbackIdx >= 0) {
                    drawImageContain(loadedFrames[fallbackIdx], 1.0);
                }
            }
        }
    }

    // --------------------------------------------------------------------------
    // 4. FLOATING HUD & HOTSPOT SYSTEMS
    // --------------------------------------------------------------------------
    
    // Create hotspot elements inside overlay DOM once
    function initHotspots() {
        hotspotsOverlay.innerHTML = '';
        hotspots.forEach(hs => {
            const div = document.createElement('div');
            div.className = `hotspot align-${hs.align}`;
            div.id = `hs-${hs.name}`;
            div.innerHTML = `
                <div class="hotspot-pulse" role="img" aria-label="${hs.label} details dot"></div>
                <div class="hotspot-label">${hs.label}</div>
            `;
            hotspotsOverlay.appendChild(div);
        });
    }

    // Toggle visibility and calculate screen positioning of active hotspots
    function updateHotspots(frameIndex, destWidth, destHeight, offsetX, offsetY) {
        hotspots.forEach(hs => {
            const el = document.getElementById(`hs-${hs.name}`);
            if (!el) return;

            const isActive = frameIndex >= hs.startFrame && frameIndex <= hs.endFrame;

            if (isActive && !prefersReducedMotion) {
                // Project 1280x720 image coordinates onto current canvas scale
                const screenX = offsetX + (hs.x / 1280) * destWidth;
                const screenY = offsetY + (hs.y / 720) * destHeight;

                el.style.left = `${screenX}px`;
                el.style.top = `${screenY}px`;
                el.classList.add('visible');
            } else {
                el.classList.remove('visible');
            }
        });
    }

    // Synchronize active sequence sidebar and scroll-section overlays
    function updateContent() {
        const frameIndex = Math.round(currentFrame);
        
        // Map current frame index to active sequence (01 to 05)
        let activeSeq = 1;
        if (frameIndex >= 810) {
            activeSeq = 5;
        } else if (frameIndex >= 630) {
            activeSeq = 4;
        } else if (frameIndex >= 450) {
            activeSeq = 3;
        } else if (frameIndex >= 270) {
            activeSeq = 2;
        } else {
            activeSeq = 1;
        }

        if (activeSeq !== activeSequence) {
            activeSequence = activeSeq;
            
            // Toggle active state in sidebar indicator steps
            document.querySelectorAll('.indicator-step').forEach(step => {
                const stepSeq = parseInt(step.getAttribute('data-seq'));
                if (stepSeq === activeSequence) {
                    step.classList.add('active');
                } else {
                    step.classList.remove('active');
                }
            });
        }

        // Fill vertical progress bar HUD line
        const progressFill = document.getElementById('indicator-progress-fill');
        if (progressFill) {
            const pct = (currentFrame / (totalFrames - 1)) * 100;
            progressFill.style.height = `${pct}%`;
        }

        // Apply smooth parallax translate & fade to text panels based on viewport center distance
        const sections = document.querySelectorAll('.scroll-section');
        sections.forEach(section => {
            const content = section.querySelector('.section-content');
            if (!content) return;

            const rect = section.getBoundingClientRect();
            const viewportHeight = window.innerHeight;
            const sectionCenter = rect.top + rect.height / 2;
            const viewportCenter = viewportHeight / 2;
            const distanceFromCenter = sectionCenter - viewportCenter;

            // Fade opacity linearly as text panel moves away from viewport center
            const fadeRange = viewportHeight * 0.6;
            let opacity = Math.max(0, 1 - Math.abs(distanceFromCenter) / fadeRange);

            // Clean up overlaps: hide text panels that are completely out of active sequence boundaries
            const sectionSeq = parseInt(section.getAttribute('data-sequence'));
            if (Math.abs(sectionSeq - activeSequence) > 1) {
                opacity = 0;
            }

            content.style.opacity = opacity;

            // Parallax translation
            if (!prefersReducedMotion) {
                const translateY = distanceFromCenter * 0.12;
                content.style.transform = `translateY(${translateY}px)`;
            } else {
                content.style.transform = 'none';
            }
        });
    }

    // --------------------------------------------------------------------------
    // 5. EVENT LISTENERS & SCROLL LOOP
    // --------------------------------------------------------------------------
    
    // Smooth scroll interpolation loop
    function updateAnimationLoop() {
        if (prefersReducedMotion) {
            isAnimating = false;
            return;
        }

        const diff = targetFrame - currentFrame;
        
        if (Math.abs(diff) > 0.05) {
            currentFrame += diff * 0.15; // Interpolation speed multiplier
            drawFrame();
            updateContent();
            requestAnimationFrame(updateAnimationLoop);
            isAnimating = true;
        } else {
            currentFrame = targetFrame;
            drawFrame();
            updateContent();
            isAnimating = false;
        }
    }

    // Passive scroll handler
    function handleScroll() {
        if (!initialPreloadComplete || prefersReducedMotion) return;

        const containerRect = scrollContainer.getBoundingClientRect();
        const containerTop = containerRect.top + window.pageYOffset;
        const containerHeight = containerRect.height;
        
        const scrollableRange = containerHeight - window.innerHeight;
        const scrolledOffset = window.pageYOffset - containerTop;
        
        // Clamp ratio strictly between 0.0 and 1.0
        const scrollRatio = Math.min(Math.max(0, scrolledOffset / scrollableRange), 1.0);
        
        // Map progress to target frame index
        targetFrame = scrollRatio * (totalFrames - 1);
        
        // Prioritize loading frames near current target
        prioritizeSurroundingFrames(targetFrame);

        // Kick off interpolation loop if not running
        if (!isAnimating) {
            isAnimating = true;
            requestAnimationFrame(updateAnimationLoop);
        }
    }

    // Recalculate canvas boundaries to prevent distortion
    function resizeCanvas() {
        const parentRect = canvas.parentElement.getBoundingClientRect();
        
        // High-DPI screen adjustments
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        
        canvas.width = parentRect.width * dpr;
        canvas.height = parentRect.height * dpr;
        
        ctx.scale(dpr, dpr);
        
        // Redraw current state
        drawFrame();
    }

    // Header blurred background trigger
    function handleHeaderScroll() {
        const header = document.querySelector('.header');
        if (window.pageYOffset > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    }

    // Mobile Hamburger Toggle
    const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
    const navMenu = document.getElementById('nav-menu');

    mobileMenuToggle.addEventListener('click', () => {
        const isOpen = mobileMenuToggle.getAttribute('aria-expanded') === 'true';
        mobileMenuToggle.setAttribute('aria-expanded', !isOpen);
        mobileMenuToggle.classList.toggle('open');
        navMenu.classList.toggle('open');
    });

    // Anchor Link Smooth Scroll
    document.querySelectorAll('.nav-link, .wordmark-link').forEach(link => {
        link.addEventListener('click', (e) => {
            const targetId = link.getAttribute('href');
            if (targetId.startsWith('#')) {
                e.preventDefault();
                
                // Close mobile menu if open
                mobileMenuToggle.setAttribute('aria-expanded', 'false');
                mobileMenuToggle.classList.remove('open');
                navMenu.classList.remove('open');

                const targetEl = document.querySelector(targetId);
                if (targetEl) {
                    targetEl.scrollIntoView({ behavior: 'smooth' });
                }
            }
        });
    });

    // Replay button scrolls smoothly to 0, which triggers reverse play automatically
    const btnReplay = document.getElementById('btn-replay');
    btnReplay.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // --------------------------------------------------------------------------
    // 6. REDUCED MOTION FALLBACK
    // --------------------------------------------------------------------------
    
    // Slow crossfading slideshow autoplaying sequence keyframes
    function drawReducedMotionFrame() {
        ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
        const img = loadedFrames[Math.round(currentFrame)];
        if (img) {
            drawImageContain(img, 1.0);
        }
    }

    function initReducedMotionMode() {
        prefersReducedMotion = true;
        
        // Hide hotspots overlay
        hotspotsOverlay.innerHTML = '';
        
        // Key image indices representing each sequence
        const keyFrames = [0, 360, 540, 720, 900];
        let activeKeyIndex = 0;
        currentFrame = keyFrames[activeKeyIndex];

        // Preload key frames immediately
        keyFrames.forEach(idx => loadImage(idx));

        // Start slow autoplaying interval
        if (reducedMotionTimer) clearInterval(reducedMotionTimer);
        reducedMotionTimer = setInterval(() => {
            activeKeyIndex = (activeKeyIndex + 1) % keyFrames.length;
            
            // Fast transition without vestibular scrolling triggers
            const targetIndex = keyFrames[activeKeyIndex];
            loadImage(targetIndex).then(() => {
                currentFrame = targetIndex;
                drawFrame();
                
                // Update side indicator progress
                document.querySelectorAll('.indicator-step').forEach(step => {
                    const stepSeq = parseInt(step.getAttribute('data-seq'));
                    if (stepSeq === (activeKeyIndex + 1)) {
                        step.classList.add('active');
                    } else {
                        step.classList.remove('active');
                    }
                });
            });
        }, 5000); // Crossfade image every 5 seconds
        
        // Render current key frame
        drawFrame();
    }

    // Check for changes in reduced-motion preference dynamically
    window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
        if (e.matches) {
            initReducedMotionMode();
        } else {
            prefersReducedMotion = false;
            if (reducedMotionTimer) {
                clearInterval(reducedMotionTimer);
                reducedMotionTimer = null;
            }
            initHotspots();
            resizeCanvas();
            handleScroll();
        }
    });

    // --------------------------------------------------------------------------
    // 7. INITIALIZE EXPERIENCE
    // --------------------------------------------------------------------------
    initHotspots();
    
    // Passive scroll listeners for scrolling and navigation transitions
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('scroll', handleHeaderScroll, { passive: true });
    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('orientationchange', () => {
        setTimeout(resizeCanvas, 200);
    });

    if (prefersReducedMotion) {
        initReducedMotionMode();
        // Hide loading screen immediately since we only need static keyframes
        loadingScreen.classList.add('fade-out');
    } else {
        startPreloading();
    }
});
