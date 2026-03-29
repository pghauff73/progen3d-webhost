(function () {
  'use strict';

  const runtime = window.PG3DEditorPage || null;
  const panel = document.getElementById('textureLibraryPanel');
  const listEl = document.getElementById('textureLibraryList');
  const statusEl = document.getElementById('textureLibraryStatus');
  const form = document.getElementById('textureUploadForm');
  const slotSelect = document.getElementById('textureSlotSelect');
  const displayNameInput = document.getElementById('textureDisplayName');
  const alphaRange = document.getElementById('textureAlphaRange');
  const alphaValueEl = document.getElementById('textureAlphaValue');
  const fileInput = document.getElementById('textureFileInput');
  const promptInput = document.getElementById('texturePromptInput');
  const generateBtn = document.getElementById('textureGenerateBtn');
  const saveMetaBtn = document.getElementById('textureSaveMetaBtn');

  if (!runtime || !panel || !listEl || !statusEl || !form || !slotSelect || !displayNameInput || !alphaRange || !alphaValueEl || !fileInput || !promptInput || !generateBtn || !saveMetaBtn) {
    return;
  }

  const SLOT_COUNT = 20;
  const transparentTexture = {
    w: 2,
    h: 2,
    data: new Uint8Array(2 * 2 * 4),
  };

  let textureItems = [];
  let started = false;
  let syncing = false;

  function setStatus(message) {
    statusEl.textContent = message;
  }

  function updateAlphaReadout() {
    alphaValueEl.textContent = Number(alphaRange.value || 1).toFixed(2);
  }

  function applyCredits(credits) {
    if (window.P3DCredits && typeof window.P3DCredits.set === 'function' && credits) {
      window.P3DCredits.set(credits);
    }
  }

  function currentSlot() {
    return String(slotSelect.value || 'usertexture1');
  }

  function slotRecord(slot) {
    return textureItems.find((item) => item && item.slot === slot) || null;
  }

  function populateForm(slot) {
    const item = slotRecord(slot);
    displayNameInput.value = item ? String(item.display_name || slot) : slot;
    alphaRange.value = item ? String(item.alpha != null ? item.alpha : 1) : '1';
    updateAlphaReadout();
  }

  async function textureHeaders() {
    const headers = { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' };
    const built = typeof runtime.buildApiHeaders === 'function' ? await runtime.buildApiHeaders() : {};
    return Object.assign(headers, built || {});
  }

  async function textureApi(action, payload, method) {
    if (typeof runtime.requestJson === 'function') {
      return runtime.requestJson('api/textures.php', action, payload || {}, method || 'POST');
    }
    throw new Error('Texture API runtime is not available.');
  }

  async function uploadTexture(formData) {
    const headers = await textureHeaders();
    delete headers['Content-Type'];
    const response = await fetch(new URL('api/textures.php?action=upload', window.location.href).toString(), {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: headers,
      body: formData,
    });
    const raw = await response.text();
    let data = null;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch (error) {
      throw new Error(raw || 'Texture upload failed');
    }
    if (!response.ok || !data || !data.ok) {
      throw new Error((data && data.error) || 'Texture upload failed');
    }
    return data;
  }

  async function loadImageData(url) {
    const headers = await textureHeaders();
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: headers,
    });
    if (!response.ok) {
      throw new Error('Could not load texture image.');
    }

    const blob = await response.blob();
    if (typeof createImageBitmap === 'function') {
      const bitmap = await createImageBitmap(blob);
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(bitmap, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      bitmap.close();
      return { w: canvas.width, h: canvas.height, data: new Uint8Array(imageData.data) };
    }

    const objectUrl = URL.createObjectURL(blob);
    try {
      const image = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Could not decode the texture image.'));
        img.src = objectUrl;
      });
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth || image.width;
      canvas.height = image.naturalHeight || image.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(image, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      return { w: canvas.width, h: canvas.height, data: new Uint8Array(imageData.data) };
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  async function applyTexturesToRenderer(items) {
    const renderer = typeof runtime.getRenderer === 'function' ? runtime.getRenderer() : null;
    if (!renderer || typeof renderer.setTexture !== 'function') {
      return;
    }

    for (let index = 1; index <= SLOT_COUNT; index += 1) {
      const slot = 'usertexture' + index;
      renderer.setTexture(slot, transparentTexture);
      renderer.textureAlpha[slot] = 0;
    }

    for (const item of items) {
      if (!item || !item.active || !item.image_url) continue;
      try {
        const imageData = await loadImageData(item.image_url);
        renderer.setTexture(item.slot, imageData);
        renderer.textureAlpha[item.slot] = Math.max(0, Math.min(1, Number(item.alpha != null ? item.alpha : 1) || 0));
      } catch (error) {
        console.warn('[TextureLibrary] Failed to apply texture', item.slot, error);
        renderer.setTexture(item.slot, transparentTexture);
        renderer.textureAlpha[item.slot] = 0;
      }
    }

    if (typeof runtime.refreshRendererTextures === 'function') {
      runtime.refreshRendererTextures();
    } else if (typeof renderer.invalidate === 'function') {
      renderer.invalidate();
    }
  }

  function renderList(items) {
    textureItems = Array.isArray(items) ? items.slice() : [];
    listEl.innerHTML = '';

    textureItems.forEach((item) => {
      const card = document.createElement('article');
      card.className = 'texture-slot-card' + (!item.active ? ' is-empty' : '');
      card.setAttribute('data-slot', item.slot);

      const preview = document.createElement(item.active ? 'img' : 'div');
      preview.className = 'texture-slot-preview';
      if (item.active) {
        preview.src = item.image_url;
        preview.alt = item.display_name || item.slot;
        preview.loading = 'lazy';
      }
      card.appendChild(preview);

      const body = document.createElement('div');
      body.className = 'texture-slot-body';

      const head = document.createElement('div');
      head.className = 'texture-slot-head';
      head.innerHTML = '<strong class="texture-slot-name">' + item.slot + '</strong><span class="texture-slot-meta">' + (item.active ? (item.display_name || item.slot) : 'Empty slot') + '</span>';
      body.appendChild(head);

      const meta = document.createElement('div');
      meta.className = 'texture-slot-meta';
      meta.textContent = item.active
        ? '512x512 PNG · alpha ' + Number(item.alpha != null ? item.alpha : 1).toFixed(2)
        : 'Ready for upload';
      body.appendChild(meta);

      const actions = document.createElement('div');
      actions.className = 'texture-slot-actions';
      actions.innerHTML =
        '<button class="btn btn-secondary btn-sm" type="button" data-action="select">Use Slot</button>' +
        '<button class="btn btn-secondary btn-sm" type="button" data-action="insert">Insert Name</button>' +
        '<button class="btn btn-danger btn-sm" type="button" data-action="delete"' + (item.active ? '' : ' disabled') + '>Delete</button>';
      body.appendChild(actions);

      card.appendChild(body);
      listEl.appendChild(card);
    });
  }

  async function refreshTextureManifest(message) {
    const data = await textureApi('list', {}, 'GET');
    renderList(data.textures || []);
    await applyTexturesToRenderer(data.textures || []);
    if (message) {
      setStatus(message);
    } else {
      setStatus('Texture library ready. Use usertexture1 to usertexture20 in the grammar.');
    }
    populateForm(currentSlot());
  }

  async function saveSlotMetadata() {
    const slot = currentSlot();
    const item = slotRecord(slot);
    if (!item || !item.active) {
      setStatus('Upload a texture into this slot before saving alpha.');
      return;
    }

    setStatus('Saving texture alpha…');
    const data = await textureApi('update', {
      slot: slot,
      display_name: displayNameInput.value.trim(),
      alpha: Number(alphaRange.value || 1),
    }, 'POST');
    await refreshTextureManifest('Saved settings for ' + slot + '.');
    populateForm(slot);
    return data;
  }

  async function generateTexture() {
    const slot = currentSlot();
    const prompt = String(promptInput.value || '').trim();
    if (!prompt) {
      setStatus('Describe the texture you want to generate.');
      promptInput.focus();
      return;
    }

    setStatus('Generating ' + slot + ' with AI…');
    generateBtn.disabled = true;
    try {
      const data = await textureApi('generate', {
        slot: slot,
        display_name: displayNameInput.value.trim(),
        alpha: Number(alphaRange.value || 1),
        prompt: prompt,
      }, 'POST');
      applyCredits(data && data.credits ? data.credits : null);
      await refreshTextureManifest('Generated texture into ' + slot + '.');
    } finally {
      generateBtn.disabled = false;
    }
  }

  async function deleteSlot(slot) {
    setStatus('Deleting ' + slot + '…');
    await textureApi('delete', { slot: slot }, 'POST');
    await refreshTextureManifest('Removed ' + slot + '.');
    if (currentSlot() === slot) {
      populateForm(slot);
    }
  }

  async function submitUpload(event) {
    event.preventDefault();
    const file = fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
    if (!file) {
      setStatus('Choose an image file before uploading.');
      return;
    }

    const slot = currentSlot();
    const formData = new FormData();
    formData.append('slot', slot);
    formData.append('display_name', displayNameInput.value.trim());
    formData.append('alpha', String(Number(alphaRange.value || 1)));
    formData.append('texture', file);

    setStatus('Uploading ' + slot + '…');
    await uploadTexture(formData);
    fileInput.value = '';
    await refreshTextureManifest('Uploaded texture into ' + slot + '.');
    populateForm(slot);
  }

  function attachEvents() {
    alphaRange.addEventListener('input', updateAlphaReadout);
    slotSelect.addEventListener('change', function () {
      populateForm(currentSlot());
    });
    form.addEventListener('submit', function (event) {
      submitUpload(event).catch(function (error) {
        setStatus(error.message || 'Texture upload failed.');
      });
    });
    saveMetaBtn.addEventListener('click', function () {
      saveSlotMetadata().catch(function (error) {
        setStatus(error.message || 'Could not save texture settings.');
      });
    });
    generateBtn.addEventListener('click', function () {
      generateTexture().catch(function (error) {
        setStatus(error.message || 'Could not generate the texture.');
      });
    });
    listEl.addEventListener('click', function (event) {
      const button = event.target.closest('[data-action]');
      if (!button) return;
      const card = button.closest('[data-slot]');
      const slot = card ? String(card.getAttribute('data-slot') || '') : '';
      if (!slot) return;
      const action = String(button.getAttribute('data-action') || '');

      if (action === 'select') {
        slotSelect.value = slot;
        populateForm(slot);
        setStatus('Selected ' + slot + '.');
        return;
      }
      if (action === 'insert') {
        runtime.insertTextAtCursor(slot);
        setStatus('Inserted ' + slot + ' into the grammar.');
        return;
      }
      if (action === 'delete') {
        deleteSlot(slot).catch(function (error) {
          setStatus(error.message || 'Could not delete the texture.');
        });
      }
    });
  }

  function maybeStart() {
    if (started || syncing) return;
    const renderer = typeof runtime.getRenderer === 'function' ? runtime.getRenderer() : null;
    if (!renderer) {
      return;
    }
    syncing = true;
    refreshTextureManifest().catch(function (error) {
      setStatus(error.message || 'Could not load your texture library.');
    }).finally(function () {
      started = true;
      syncing = false;
    });
  }

  attachEvents();
  updateAlphaReadout();
  populateForm(currentSlot());
  window.addEventListener('p3d:editorready', maybeStart);
  window.addEventListener('p3d:rendererready', maybeStart);
  window.addEventListener('load', maybeStart, { once: true });
})();
