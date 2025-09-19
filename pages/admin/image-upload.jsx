import React, { useState, useCallback, useRef } from 'react';
import Cropper from 'react-easy-crop';

function createImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener('load', () => resolve(img));
    img.addEventListener('error', (err) => reject(err));
    img.setAttribute('crossOrigin', 'anonymous');
    img.src = url;
  });
}

function getCroppedImg(imageSrc, pixelCrop) {
  return new Promise(async (resolve, reject) => {
    try {
      const image = await createImage(imageSrc);
      const canvas = document.createElement('canvas');
      const width = Math.round(pixelCrop.width);
      const height = Math.round(pixelCrop.height);
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      const sx = Math.round(pixelCrop.x ?? pixelCrop.left ?? 0);
      const sy = Math.round(pixelCrop.y ?? pixelCrop.top ?? 0);
      ctx.drawImage(
        image,
        sx,
        sy,
        width,
        height,
        0,
        0,
        width,
        height
      );
      canvas.toBlob((blob) => {
        resolve(blob);
      }, 'image/png');
    } catch (e) {
      reject(e);
    }
  });
}

export default function ImageUploadPage() {
  const [fileUrl, setFileUrl] = useState(null);
  const [fileName, setFileName] = useState(null);
  const [originalFile, setOriginalFile] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [croppedPreview, setCroppedPreview] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  const inputRef = useRef();

  const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const onFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    setOriginalFile(f);
    const url = URL.createObjectURL(f);
    setFileUrl(url);
    setResult(null);
  };

  const [useOriginal, setUseOriginal] = useState(false);
  const [aspect, setAspect] = useState('16/9');

  const uploadCropped = async () => {
    setErrorMsg(null);
    if (useOriginal) {
      if (!originalFile) { setErrorMsg('No file selected'); return; }
      setLoading(true);
      setResult(null);
      try {
        const fd = new FormData();
        fd.append('image', originalFile, fileName || originalFile.name);
        const res = await fetch('/api/admin/upload-image', { method: 'POST', body: fd });
        const json = await res.json();
        setResult(json);
      } catch (err) {
        setResult({ error: err.message || String(err) });
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!fileUrl || !croppedAreaPixels) {
      setErrorMsg('No file or crop area');
      return;
    }
    if (!croppedAreaPixels.width || !croppedAreaPixels.height) {
      setErrorMsg('Crop area has zero width/height');
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      // send the original file plus crop coordinates so the server can extract the exact region
      // at full resolution and then generate cover/thumb. This avoids double-scaling/misalignment.
      const fd = new FormData();
      fd.append('image', originalFile, fileName || originalFile.name);
      if (croppedAreaPixels) {
        fd.append('cropX', String(Math.round(croppedAreaPixels.x || 0)));
        fd.append('cropY', String(Math.round(croppedAreaPixels.y || 0)));
        fd.append('cropW', String(Math.round(croppedAreaPixels.width || 0)));
        fd.append('cropH', String(Math.round(croppedAreaPixels.height || 0)));
      }
      // keep client preview unchanged for UX
      try {
        const prev = await getCroppedImg(fileUrl, croppedAreaPixels);
        if (prev) {
          const prevUrl = URL.createObjectURL(prev);
          setCroppedPreview(prevUrl);
          try { window.__lastCroppedPreview = prevUrl; } catch(e){}
        }
      } catch (e) { console.debug('preview create failed', e); }

      const res = await fetch('/api/admin/upload-image', { method: 'POST', body: fd });
      const json = await res.json();
      setResult(json);
    } catch (err) {
      setResult({ error: err.message || String(err) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <h2>Admin Image Upload (Crop)</h2>
      <input ref={inputRef} type="file" accept="image/*" onChange={onFileChange} />

      {fileUrl && (
        <div>
          <div style={{ marginTop: 12 }}>
            <label style={{ marginRight: 12 }}><input type="checkbox" checked={useOriginal} onChange={e => setUseOriginal(e.target.checked)} /> Use original (no crop)</label>
            <label>Aspect: </label>
            <select value={aspect} onChange={e => setAspect(e.target.value)} style={{ marginLeft: 8 }}>
              <option value="16/9">16:9</option>
              <option value="4/3">4:3</option>
              <option value="1/1">1:1</option>
              <option value="free">Free</option>
            </select>
          </div>

          {!useOriginal && (
            <div style={{ position: 'relative', width: 800, height: 450, background: '#333', marginTop: 12 }}>
              <Cropper
                image={fileUrl}
                crop={crop}
                zoom={zoom}
                aspect={aspect === 'free' ? undefined : eval(aspect)}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: 12 }}>
        <button onClick={uploadCropped} disabled={!fileUrl || loading}>{loading ? 'Uploading...' : 'Upload Cropped'}</button>
      </div>

      {errorMsg && <div style={{ color: 'crimson', marginTop: 12 }}>{errorMsg}</div>}
      {croppedPreview && (
        <div style={{ marginTop: 12 }}>
          <h4>Cropped preview</h4>
          <img src={croppedPreview} alt="cropped preview" style={{ maxWidth: 600 }} />
        </div>
      )}

      {result && (
        <div style={{ marginTop: 16 }}>
          <h3>Result</h3>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(result, null, 2)}</pre>
          {result.dimensions && (
            <div style={{ marginTop: 8 }}>
              <h4>Dimensions</h4>
              <div>Original: {result.dimensions.original.width} x {result.dimensions.original.height}</div>
              <div>Cover: {result.dimensions.cover.width} x {result.dimensions.cover.height}</div>
              <div>Thumb: {result.dimensions.thumb.width} x {result.dimensions.thumb.height}</div>
              <div style={{ marginTop: 8 }}>
                <button onClick={() => {
                  try {
                    const txt = JSON.stringify(result.dimensions);
                    navigator.clipboard.writeText(txt);
                    console.log('Copied dimensions to clipboard', txt);
                  } catch (e) { console.debug('copy failed', e); }
                }}>Copy dimensions JSON</button>
              </div>
            </div>
          )}
          {result.cover && <div><h4>Cover</h4><img src={result.cover} alt="cover" style={{ maxWidth: 400 }} /></div>}
          {result.thumb && <div><h4>Thumb</h4><img src={result.thumb} alt="thumb" style={{ maxWidth: 200 }} /></div>}
        </div>
      )}
    </div>
  );
}
