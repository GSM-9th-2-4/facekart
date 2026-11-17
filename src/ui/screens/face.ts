import { MAX_FACES, storage } from '../../core/storage';
import { btn, h, screen, type FaceSource, type UiCtx } from '../dom';

export function faceScreen(ctx: UiCtx) {
  const { face: facePipe, on } = ctx.deps;
  let pending: string | null = null; // processed face waiting to be saved
  let stopCam: (() => void) | null = null;
  let destroyed = false;

  const status = h('p', { class: 'fk-note', role: 'status' });
  const setStatus = (msg: string, error = false) => {
    status.textContent = msg;
    status.classList.toggle('fk-error', error);
  };

  // ---- capture side ----
  const headImg = h('img', { alt: 'Face preview', hidden: true });
  const head = h('div', { class: 'fk-head' }, headImg, h('span', { class: 'fk-head-empty' }, '?'));
  const video = h('video', { class: 'fk-video', autoplay: true, muted: true, playsInline: true, hidden: true });
  const fileInput = h('input', { type: 'file', accept: 'image/*', hidden: true, onchange: () => onFile() });
  const nameInput = h('input', { type: 'text', maxLength: 16, placeholder: 'Face name', 'aria-label': 'Face name' });
  const saveBtn = btn('Save face', () => save(), 'fk-primary', { disabled: true });
  const camBtn = btn('Webcam', () => toggleCam());
  const snapBtn = btn('Capture', () => process(video), 'fk-primary', { hidden: true });
  const uploadBtn = btn('Upload photo', () => fileInput.click(), '', { autofocus: true });

  function setPending(url: string | null) {
    pending = url;
    headImg.hidden = !url;
    if (url) headImg.src = url;
    saveBtn.disabled = !url;
  }

  async function process(src: FaceSource) {
    setBusy(true);
    setStatus('Finding your face…');
    try {
      const r = await facePipe.createFaceFromImage(src);
      if (destroyed) return;
      if (r.ok) {
        setPending(r.dataUrl);
        setStatus('Looking good! Name it and press Save.');
        if (!nameInput.value) nameInput.value = `Face ${storage.getFaces().length + 1}`;
      } else setStatus(r.error, true);
    } catch (e) {
      if (!destroyed) setStatus(`Face processing failed: ${e instanceof Error ? e.message : String(e)}`, true);
    } finally {
      if (!destroyed) setBusy(false);
    }
  }

  async function onFile() {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return setStatus('Please choose an image file.', true);
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      await process(img);
    } catch {
      setStatus('Could not read that image.', true);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function toggleCam() {
    if (stopCam) return closeCam();
    setBusy(true);
    try {
      video.hidden = false;
      const stop = await facePipe.startWebcam(video);
      if (destroyed) return stop();
      stopCam = stop;
      camBtn.textContent = 'Stop webcam';
      snapBtn.hidden = false;
      snapBtn.focus();
      setStatus('Look at the camera and press Capture.');
    } catch (e) {
      video.hidden = true;
      setStatus(`Webcam unavailable: ${e instanceof Error ? e.message : 'permission denied?'}`, true);
    } finally {
      if (!destroyed) setBusy(false);
    }
  }
  function closeCam() {
    stopCam?.();
    stopCam = null;
    video.hidden = true;
    snapBtn.hidden = true;
    camBtn.textContent = 'Webcam';
  }

  function setBusy(b: boolean) {
    for (const x of [uploadBtn, camBtn, snapBtn]) x.disabled = b;
  }

  function save() {
    if (!pending) return;
    const id = `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const name = nameInput.value.trim() || 'My face';
    const r = storage.addFace({ id, name, dataUrl: pending });
    if (!r.ok) return setStatus(r.error, true);
    if (!storage.getSelectedFaceId()) storage.setSelectedFaceId(id);
    setPending(null);
    nameInput.value = '';
    setStatus(`Saved "${name}".`);
    on.onSelectionChanged?.();
    renderList();
  }

  // ---- saved faces ----
  const list = h('div', { class: 'fk-face-list' });
  function renderList() {
    const faces = storage.getFaces();
    const selId = storage.getSelectedFaceId();
    const ai = new Set(storage.getAiFaceIds());
    const select = (id: string | null) => {
      storage.setSelectedFaceId(id);
      on.onSelectionChanged?.();
      renderList();
    };
    list.replaceChildren(
      h('h3', {}, `Saved faces (${faces.length}/${MAX_FACES})`),
      h('div', { class: `fk-face-item ${selId ? '' : 'fk-on'}` },
        h('div', { class: 'fk-face-thumb fk-head-empty' }, '?'),
        h('b', {}, 'Default head'),
        btn(selId ? 'Use' : 'In use', () => select(null), 'fk-small', { disabled: !selId }),
      ),
      ...faces.map((f) =>
        h('div', { class: `fk-face-item ${f.id === selId ? 'fk-on' : ''}` },
          h('img', { class: 'fk-face-thumb', src: f.dataUrl, alt: f.name }),
          h('b', {}, f.name),
          btn(f.id === selId ? 'In use' : 'Use', () => select(f.id), 'fk-small', { disabled: f.id === selId }),
          h('label', { class: 'fk-check', title: 'AI racers may wear this face' },
            h('input', {
              type: 'checkbox', checked: ai.has(f.id),
              onchange: (e: Event) => {
                const on = (e.target as HTMLInputElement).checked;
                const ids = storage.getAiFaceIds().filter((x) => x !== f.id);
                storage.setAiFaceIds(on ? [...ids, f.id] : ids);
              },
            }),
            'AI',
          ),
          btn('Delete', () => {
            if (!confirm(`Delete "${f.name}"?`)) return;
            storage.deleteFace(f.id);
            on.onSelectionChanged?.();
            renderList();
          }, 'fk-small fk-danger'),
        ),
      ),
    );
  }
  renderList();

  const back = () => ctx.go('lobby');
  const el = screen(
    'fk-face',
    h('h2', { class: 'fk-screen-title' }, 'Face registration'),
    h('div', { class: 'fk-split' },
      h('div', { class: 'fk-panel fk-capture' },
        h('div', { class: 'fk-capture-view' }, video, head),
        h('div', { class: 'fk-menu-row' }, uploadBtn, camBtn, snapBtn, fileInput),
        h('p', { class: 'fk-note' }, 'Tip: a front-facing photo with good light works best.'),
        h('div', { class: 'fk-menu-row' }, nameInput, saveBtn),
        status,
      ),
      h('div', { class: 'fk-panel' }, list, h('div', { class: 'fk-actions' }, btn('Back', back))),
    ),
  );
  return {
    el,
    back,
    destroy() {
      destroyed = true;
      closeCam();
    },
  };
}
