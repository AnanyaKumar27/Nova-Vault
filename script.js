//SUPABASE CLIENT
if (typeof supabase === 'undefined') {
    console.error('Supabase CDN failed. Check internet or try another mirror.');
    document.body.innerHTML = '<h1 style="color:red; text-align:center; margin-top:100px;">Failed to load Supabase. Check your internet or try reloading.</h1>';
    throw new Error('Supabase CDN failed');
}

const SUPABASE_URL = 'https://ckerpiaxxsebmfkzesid.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNrZXJwaWF4eHNlYm1ma3plc2lkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMzA1MzEsImV4cCI6MjA3ODgwNjUzMX0.d0f62pdLoQSF0a35BEs7IAqiclLPdROSQv7luHvLxHI';
const { createClient } = supabase;
const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window.supabase = client;
console.log('NOVA VAULT initialized with Supabase (Cloudflare CDN)');

// LOCAL BLOB URL CACHE
const localUrlCache = new Map(); 

// IndexedDB setup for persistent blob URLs
let idb;
const IDB_NAME = 'nova-vault-blobs';
const IDB_VERSION = 1;

function openIDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(IDB_NAME, IDB_VERSION);
        req.onupgradeneeded = e => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('blobs')) {
                db.createObjectStore('blobs');
            }
        };
        req.onsuccess = e => {
            idb = e.target.result;
            resolve(idb);
        };
        req.onerror = () => reject(req.error);
    });
}

async function cacheBlobUrls(fileId, originalFile, optimizedFile) {
    try {
        const db = await openIDB();
        const tx = db.transaction('blobs', 'readwrite');
        const store = tx.objectStore('blobs');

        const origUrl = URL.createObjectURL(originalFile);
        const optUrl = URL.createObjectURL(optimizedFile);

        store.put(origUrl, fileId + '_orig');
        store.put(optUrl, fileId + '_opt');

        await tx.done;

        localUrlCache.set(fileId + '_orig', origUrl);
        localUrlCache.set(fileId + '_opt', optUrl);
    } catch (e) {
        console.warn('IndexedDB cache failed', e);
    }
}

async function loadCachedUrls() {
    try {
        const db = await openIDB();
        const tx = db.transaction('blobs', 'readonly');
        const store = tx.objectStore('blobs');

        const keys = await store.getAllKeys();
        const values = await store.getAll();

        keys.forEach((key, i) => {
            localUrlCache.set(key, values[i]);
        });

        console.log(`Loaded ${keys.length} cached blob URLs`);
    } catch (e) {
        console.warn('Failed to load cached URLs', e);
    }
}

// Load cached URLs on startup
loadCachedUrls();

// === GPU ACCELERATION (WebGL) ===
(async () => {
    try {
        await tf.setBackend('webgl');
        await tf.ready();
        console.log('GPU enabled:', tf.getBackend());
    } catch (e) {
        console.warn('WebGL unavailable → CPU fallback', e);
    }
})();

// === AI MODEL ===
let model;
async function loadModel() {
    if (model) return model;
    try {
        model = await mobilenet.load();
        console.log('MobileNet loaded');
    } catch (err) {
        console.error('Failed to load MobileNet:', err);
    }
    return model;
}
loadModel();

// === PARTICLE BACKGROUND ===
const particlesHolder = document.getElementById('particles');
if (particlesHolder) {
    const canvas = document.createElement('canvas');
    particlesHolder.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    canvas.width = innerWidth;
    canvas.height = innerHeight;
    window.addEventListener('resize', () => {
        canvas.width = innerWidth;
        canvas.height = innerHeight;
    });
    class Particle {
        constructor() { this.reset(); }
        reset() {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
            this.size = Math.random() * 2 + 1;
            this.speedX = Math.random() * 1.5 - 0.75;
            this.speedY = Math.random() * 1.5 - 0.75;
        }
        update() {
            this.x += this.speedX;
            this.y += this.speedY;
            if (this.x < 0 || this.x > canvas.width) this.speedX *= -1;
            if (this.y < 0 || this.y > canvas.height) this.speedY *= -1;
        }
        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0,255,204,0.8)';
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#00ffcc';
            ctx.fill();
        }
    }
    const particles = Array.from({ length: 120 }, () => new Particle());
    (function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach(p => { p.update(); p.draw(); });
        requestAnimationFrame(animate);
    })();
}

// === UI: Smooth Scroll, Header, Animations ===
document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
        e.preventDefault();
        const target = document.querySelector(a.getAttribute('href'));
        if (target) target.scrollIntoView({ behavior: 'smooth' });
    });
});
window.addEventListener('scroll', () => {
    const header = document.getElementById('header');
    if (header) header.classList.toggle('scrolled', window.scrollY > 50);
});
const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
        if (entry.isIntersecting) entry.target.classList.add('visible');
    });
}, { threshold: 0.1 });
document.querySelectorAll('section').forEach(s => observer.observe(s));

// === TABS ===
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        const tab = document.getElementById(btn.dataset.tab);
        if (tab) tab.classList.add('active');
    });
});

// === MEDIA VALIDATOR ===
function isValidMedia(file) {
    const allowedMime = [
        "image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif",
        "video/mp4", "video/quicktime", "video/webm", "video/x-matroska",
        "audio/mpeg", "audio/wav", "audio/ogg", "audio/flac", "audio/aac",
        "application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/json", "text/plain", "application/zip", "application/x-rar-compressed"
    ];
    if (allowedMime.includes(file.type)) return true;
    const ext = (file.name || "").split(".").pop().toLowerCase();
    const allowedExt = ["jpg", "jpeg", "png", "webp", "gif", "heic", "heif", "mp4", "mov", "webm", "mkv", "mp3", "wav", "pdf", "doc", "docx", "json", "zip", "rar"];
    return allowedExt.includes(ext);
}
// === MEDIA UPLOAD ===
let processing = 0;
const MAX_CONCURRENT = 8;
const uploadBtn = document.getElementById('upload-media-btn');
if (uploadBtn) uploadBtn.addEventListener('click', onUploadMedia);

async function onUploadMedia() {
    const btn = uploadBtn;
    const input = document.getElementById('media-file');
    const files = input?.files ? Array.from(input.files) : [];
    const hint = document.getElementById('media-comment')?.value.trim().toLowerCase() || '';
    const out = document.getElementById('media-output');

    if (!files.length) {
        out.innerHTML = '<p style="color:var(--danger)">Please select files.</p>';
        return;
    }

    btn.classList.add('loading');
    btn.textContent = '';
    out.innerHTML = '<p>AI analyzing…</p>';

    await loadModel();

    // HEIC → JPEG converter
    const convertHEICtoJPEG = file => new Promise(resolve => {
        const isHEIC = /\.(heic|heif)$/i.test(file.name) || ["image/heic", "image/heif"].includes(file.type);

        if (!isHEIC) return resolve(file);

        const reader = new FileReader();
        reader.onload = e => {
            const img = new Image();
            img.onload = () => {
                const c = document.createElement('canvas');
                c.width = img.width;
                c.height = img.height;
                c.getContext('2d').drawImage(img, 0, 0);
                c.toBlob(blob => {
                    const newFile = new File([blob], file.name.replace(/\.(heic|heif)$/i, '.jpg'), {
                        type: 'image/jpeg'
                    });
                    resolve(newFile);
                }, 'image/jpeg', 0.9);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });

    // Resize image
    const resizeImageToJpeg = (file, max = 1024) => new Promise(resolve => {
        const img = new Image();
        const reader = new FileReader();

        reader.onload = e => img.src = e.target.result;

        img.onload = () => {
            const c = document.createElement('canvas');
            let w = img.width, h = img.height;

            if (w > h && w > max) { h = Math.round(h * (max / w)); w = max; }
            else if (h > max) { w = Math.round(w * (max / h)); h = max; }

            c.width = Math.max(1, w);
            c.height = Math.max(1, h);
            const ctx = c.getContext('2d');
            ctx.drawImage(img, 0, 0, c.width, c.height);

            c.toBlob(blob => {
                const optimizedFile = new File([blob], file.name.replace(/\.[^/.]+$/, '.jpg'), {
                    type: 'image/jpeg'
                });
                resolve(optimizedFile);
            }, 'image/jpeg', 0.8);
        };

        reader.readAsDataURL(file);
    });

    // Process each file
    const processFile = async file => {
        let originalFile = file;

        try { originalFile = await convertHEICtoJPEG(file); }
        catch (e) { console.warn('HEIC convert failed', e); }

        let optimizedFile = originalFile;

        if (originalFile.type.startsWith('image/')) {
            try { optimizedFile = await resizeImageToJpeg(originalFile, 1024); }
            catch (e) { console.warn('Resize failed', e); }
        }

        let category = 'uncategorized';
        let tags = [originalFile.type.split('/')[0]];
        let embedding = Array(1024).fill(0);

        // === FIXED: Correct "category" bug ===
        if (originalFile.type.startsWith('image/') && model) {
            const img = new Image();
            img.src = URL.createObjectURL(optimizedFile);
            await new Promise(r => img.onload = r);

            try {
                const results = await model.classify(img);

                // FIXED: ccategory → category
                category = results[0].className.toLowerCase().split(',')[0];

                tags.push(...results.map(r =>
                    r.className.split(',')[0].toLowerCase()
                ));

                const activation = model.infer(img, 'conv_preds');
                embedding = (await activation.array()).flat();
                activation.dispose();

            } catch (e) {
                console.warn('AI failed', e);
            }

            URL.revokeObjectURL(img.src);
        }

        if (hint) tags.push(hint);
        tags = [...new Set(tags)];

        const fileId = `${crypto.randomUUID()}.${originalFile.name.split('.').pop()}`;

        // ---------------------------------------------------
        // FIX 2: Upload BEFORE generating public URLs
        // ---------------------------------------------------
        const { error: uploadOrigErr } = await supabase.storage
            .from('nova-vault-media')
            .upload(`original/${fileId}`, originalFile, { upsert: true });

        if (uploadOrigErr) throw uploadOrigErr;

        const { error: uploadOptErr } = await supabase.storage
            .from('nova-vault-media')
            .upload(`optimized/${fileId}`, optimizedFile, { upsert: true });

        if (uploadOptErr) throw uploadOptErr;

        // AFTER upload → now generate working public URLs
        const { data: origPublic } = supabase
            .storage
            .from('nova-vault-media')
            .getPublicUrl(`original/${fileId}`);

        const { data: optPublic } = supabase
            .storage
            .from('nova-vault-media')
            .getPublicUrl(`optimized/${fileId}`);

        const original_url = origPublic.publicUrl;
        const optimized_url = optPublic.publicUrl;

        // Cache in IndexedDB
        await cacheBlobUrls(fileId, originalFile, optimizedFile);

        // Insert metadata
        const { data: mediaRec, error: dbErr } = await supabase
            .from('media')
            .insert({
                file_name: file.name,
                file_type: file.type,
                original_url,
                optimized_url,
                category,
                tags,
                hint
            })
            .select()
            .single();

        if (dbErr) throw dbErr;

        await supabase.from('embeddings').insert({
            media_id: mediaRec.id,
            embedding
        });

        // Output result
        const el = document.createElement('div');
        el.className = 'result-item visible';

        el.innerHTML = `
            <strong>${file.name}</strong> → <em>${category}</em><br>
            <small>Tags: ${tags.map(t =>
            `<span class="tag">${t}</span>`
        ).join('')}</small>
            <br>
            <small style="color:#00ffcc;">
                Original: <a href="${original_url}" target="_blank">Open</a> —
                Optimized: <a href="${optimized_url}" target="_blank">Open</a>
            </small>
        `;

        out.appendChild(el);
    };

    for (const file of files) {
        if (!isValidMedia(file)) {
            const el = document.createElement('div');
            el.className = 'result-item visible';
            el.innerHTML = `<strong>${file.name}</strong> → <em style="color:var(--danger)">Unsupported</em>`;
            out.appendChild(el);
            continue;
        }

        while (processing >= MAX_CONCURRENT)
            await new Promise(r => setTimeout(r, 50));

        processing++;

        (async () => {
            try { await processFile(file); }
            catch (err) {
                const el = document.createElement('div');
                el.className = 'result-item visible';
                el.innerHTML =
                    `<strong>${file.name}</strong> → <em style="color:var(--danger)">Failed: ${err.message}</em>`;
                out.appendChild(el);
            } finally {
                processing--;
                if (processing === 0) {
                    btn.classList.remove('loading');
                    btn.textContent = 'Store';
                    const p = out.querySelector('p');
                    if (p) p.remove();
                }
            }
        })();
    }
}

// === SEARCH (unchanged except local/remote URLs) ===
let searchOffset = 0;
const SEARCH_LIMIT = 20;
const searchBtn = document.getElementById('search-btn');

if (searchBtn) searchBtn.addEventListener('click', () => performSearch(true));

async function performSearch(reset = false) {
    const q = document.getElementById('search-query')?.value.trim().toLowerCase() || '';
    const out = document.getElementById('search-output');
    const loadMoreContainer = document.getElementById('load-more-container');

    if (!q) return;

    if (reset) {
        searchOffset = 0;
        out.innerHTML = '';
        loadMoreContainer.style.display = 'none';
    }

    out.innerHTML = '<p>Searching…</p>';

    const btn = searchBtn;
    btn.classList.add('loading');
    btn.textContent = '';

    let hits = 0;

    const append = el => {
        out.appendChild(el);
        setTimeout(() => el.classList.add('visible'), hits++ * 80);
    };

    try {
        const { data: media, error: mediaErr } = await supabase
            .from('media')
            .select('*')
            .or(`file_name.ilike.%${q}%,category.ilike.%${q}%,tags.cs.{${q}}`)
            .range(searchOffset, searchOffset + SEARCH_LIMIT - 1);

        if (mediaErr) throw mediaErr;

        media?.forEach(m => {
            const origUrl = localUrlCache.get(m.id + '_orig') || m.original_url;
            const optUrl = localUrlCache.get(m.id + '_opt') || m.optimized_url;
            const isVideo = m.file_type.startsWith('video/');

            const el = document.createElement('div');
            el.className = 'result-item';
            el.innerHTML = `
        <strong>[MEDIA]</strong> ${m.file_name} → <em>${m.category}</em><br>
        ${isVideo
                    ? `<video src="${optUrl}" controls width="320" style="margin-top:8px;"></video>`
                    : `<img src="${optUrl}" width="180" style="margin-top:8px;">`
                }
        <br>
        <small>
            <a href="${origUrl}" download="${m.file_name}" style="color:#00ffcc;">Download Original</a> — 
            <a href="${optUrl}" download="${m.file_name}" style="color:#00ffcc;">Download Optimized</a>
        </small>
    `;
            append(el);
        });

        searchOffset += media?.length || 0;

        const { data: cols } = await supabase.from('collections').select('name,type,data');

        cols?.forEach(col => {
            col.data.forEach((row, i) => {
                if (JSON.stringify(row).toLowerCase().includes(q)) {
                    const el = document.createElement('div');
                    el.className = 'result-item';
                    el.innerHTML = `<strong>[${col.type.toUpperCase()}]</strong> ${col.name}[${i}]: ${JSON.stringify(row)}`;
                    append(el);
                }
            });
        });

        if (media && media.length === SEARCH_LIMIT) {
            loadMoreContainer.style.display = 'block';
            document.getElementById('load-more-btn').onclick = () => performSearch(false);
        } else {
            loadMoreContainer.style.display = 'none';
        }

        if (hits === 0)
            out.innerHTML = '<p>No results found.</p>';

    } catch (err) {
        console.error(err);
        out.innerHTML = '<p style="color:var(--danger)">Search error.</p>';
    } finally {
        btn.classList.remove('loading');
        btn.textContent = 'Search';
    }
}
/* ============================
   JSON STORAGE (FULL FIX)
   ============================ */

// Load JSON file into textarea
document.getElementById("json-file-input")?.addEventListener("change", async e => {
    const file = e.target.files[0];
    if (!file) return;

    try {
        const text = await file.text();
        document.getElementById("json-input").value = text;
    } catch (err) {
        document.getElementById("json-output").innerHTML =
            `<p style="color:var(--danger)">Failed to load JSON file.</p>`;
    }
});

// Store JSON into the "collections" table
document.getElementById("store-json-btn")?.addEventListener("click", async () => {
    const raw = document.getElementById("json-input").value.trim();
    const name = document.getElementById("json-comment").value.trim() || "json_collection";
    const out = document.getElementById("json-output");

    if (!raw) {
        out.innerHTML = `<p style="color:var(--danger)">JSON is empty.</p>`;
        return;
    }

    let parsed;
    try {
        parsed = JSON.parse(raw);
    } catch (err) {
        out.innerHTML = `<p style="color:var(--danger)">Invalid JSON format.</p>`;
        return;
    }

    // Convert single object → array
    if (!Array.isArray(parsed)) parsed = [parsed];

    const { error } = await supabase.from("collections").insert({
        name,
        type: "json",
        data: parsed
    });

    if (error) {
        out.innerHTML = `<p style="color:var(--danger)">Store failed: ${error.message}</p>`;
    } else {
        out.innerHTML = `<p style="color:var(--success)">Stored JSON successfully!</p>`;
    }
});

// Analyze JSON → SQL or NoSQL
document.getElementById("analyze-schema-btn")?.addEventListener("click", () => {
    const raw = document.getElementById("json-input").value.trim();
    const out = document.getElementById("analyze-output");

    if (!raw) {
        out.textContent = "No JSON entered.";
        return;
    }

    let parsed;
    try { parsed = JSON.parse(raw); }
    catch (err) {
        out.textContent = "Invalid JSON.";
        return;
    }

    if (!Array.isArray(parsed)) parsed = [parsed];
    if (!parsed.length) {
        out.textContent = "Empty JSON.";
        return;
    }

    const sample = parsed[0];
    let sql = "CREATE TABLE my_table (\n";

    Object.entries(sample).forEach(([key, val]) => {
        let type = "TEXT";
        if (typeof val === "number") type = "FLOAT";
        if (typeof val === "boolean") type = "BOOLEAN";
        if (typeof val === "object") type = "JSONB";
        sql += `  ${key} ${type},\n`;
    });

    sql = sql.replace(/,\n$/, "\n);");

    out.textContent =
        "=== SQL TABLE ===\n" +
        sql +
        "\n\n=== Recommended NoSQL Structure ===\n" +
        JSON.stringify(sample, null, 2);
});


// === PRELOADER ===
setTimeout(() => {
    const pre = document.getElementById('preloader');
    if (pre) pre.classList.add('hidden');

}, 1500);
