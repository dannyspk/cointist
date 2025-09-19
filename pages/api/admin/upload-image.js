import { createClient } from '@supabase/supabase-js';

export const config = {
  api: {
    bodyParser: false,
  },
};

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY);

function safeName(name) {
  return name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\-\.]/g, '');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // Dynamically import formidable and support either v2 (IncomingForm) or v3+ (factory)
    const FormidableModule = await import('formidable');
    const mod = FormidableModule.default || FormidableModule;
    let form;
    if (typeof mod === 'function') {
      // v3+ exposes a factory function
      form = mod({ multiples: false });
    } else if (mod && (mod.IncomingForm || mod.Formidable)) {
      const Incoming = mod.IncomingForm || mod.Formidable;
      form = new Incoming({ multiples: false });
    } else {
      throw new Error('Unsupported formidable module shape: ' + Object.keys(FormidableModule).join(','));
    }

    // Add some event logging for debug and use a timeout so parse can't hang indefinitely
    form.on('fileBegin', (name, file) => console.debug('[upload-image] fileBegin', name, file && file.originalFilename));
    form.on('file', (name, file) => console.debug('[upload-image] file', name, file && (file.originalFilename || file.newFilename || file.filepath)));
    form.on('error', (err) => console.error('[upload-image] formidable error', err));

    const parsePromise = new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) return reject(err);
        resolve({ fields, files });
      });
    });

    // timeout after 30s to avoid hanging requests
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Form parse timeout')), 30000));
    const { files, fields } = await Promise.race([parsePromise, timeoutPromise]);

    // formidable gives file objects; handle first file named 'image' or any file
    console.debug('[upload-image] files keys:', Object.keys(files || {}));
    let fileEntry = files.image || Object.values(files || {})[0];
    // handle common wrappers where the file is an array or numeric-keyed object
    if (Array.isArray(fileEntry)) {
      fileEntry = fileEntry[0];
    }
    if (fileEntry && (fileEntry['0'] || fileEntry[0])) {
      fileEntry = fileEntry[0] || fileEntry['0'];
    }
    if (!fileEntry) return res.status(400).json({ error: 'No file uploaded' });

    // Resolve the uploaded file into a Buffer across different formidable shapes
    const fs = await import('fs');
    const originalFilename = fileEntry.originalFilename || fileEntry.name || fileEntry.newFilename || `upload-${Date.now()}`;
    const mimeType = fileEntry.mimetype || fileEntry.type || fileEntry.contentType || 'application/octet-stream';

    console.debug('[upload-image] fileEntry keys:', Object.keys(fileEntry || {}));

    let buffer;
    const candidatePath = fileEntry.filepath || fileEntry.path || fileEntry.filePath || (fileEntry._writeStream && fileEntry._writeStream.path);
    if (candidatePath) {
      buffer = fs.promises ? await fs.promises.readFile(candidatePath) : fs.readFileSync(candidatePath);
    } else if (fileEntry.buffer && Buffer.isBuffer(fileEntry.buffer)) {
      buffer = fileEntry.buffer;
    } else if (fileEntry.data && Buffer.isBuffer(fileEntry.data)) {
      buffer = fileEntry.data;
    } else if (typeof fileEntry.toBuffer === 'function') {
      buffer = await fileEntry.toBuffer();
    } else if (fileEntry.file && fileEntry.file.readable) {
      // some parsers place the stream on fileEntry.file
      buffer = await new Promise((resolve, reject) => {
        const chunks = [];
        fileEntry.file.on('data', (c) => chunks.push(c));
        fileEntry.file.on('end', () => resolve(Buffer.concat(chunks)));
        fileEntry.file.on('error', reject);
      });
    } else if (fileEntry.stream && typeof fileEntry.stream.on === 'function') {
      const stream = fileEntry.stream;
      buffer = await new Promise((resolve, reject) => {
        const chunks = [];
        stream.on('data', (c) => chunks.push(c));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', reject);
      });
    } else {
      console.error('[upload-image] unsupported fileEntry shape', Object.keys(fileEntry || {}));
      return res.status(400).json({ error: 'Unsupported file shape', keys: Object.keys(fileEntry || {}) });
    }

  console.debug('[upload-image] received buffer length', buffer && buffer.length);
  if (!buffer || buffer.length === 0) return res.status(400).json({ error: 'No file uploaded or zero-length buffer', length: buffer && buffer.length });

    // generate safe, unique base name
    const id = Date.now().toString() + '-' + Math.random().toString(36).slice(2, 8);
    const base = `${id}-${safeName(originalFilename)}`;
    const originalPath = `original/${base}`;
    const coverPath = `cover/${base}.webp`;
    const thumbPath = `thumb/${base}.webp`;

    // If client supplied crop coordinates, extract that region from the original image first
    // so server-side resizing uses the exact pixels the user selected at full resolution.
    const cropX = fields?.cropX ? parseInt(fields.cropX, 10) : null;
    const cropY = fields?.cropY ? parseInt(fields.cropY, 10) : null;
    const cropW = fields?.cropW ? parseInt(fields.cropW, 10) : null;
    const cropH = fields?.cropH ? parseInt(fields.cropH, 10) : null;

    // lazy-load sharp for image operations
    let _sharp;
    try { _sharp = (await import('sharp')).default || (await import('sharp')); } catch (e) { _sharp = null }

    let sourceBuffer = buffer;
    if (_sharp && cropX !== null && cropY !== null && cropW !== null && cropH !== null) {
      try {
        // sharp.extract expects integer left/top/width/height
        sourceBuffer = await _sharp(buffer).rotate().extract({ left: cropX, top: cropY, width: cropW, height: cropH }).toBuffer();
      } catch (e) {
        console.debug('[upload-image] crop extract failed, falling back to original buffer', e);
        sourceBuffer = buffer;
      }
    }

    // produce resized images without additional cropping so client-side crop is preserved.
    // Approach: resize the uploaded image to fit inside target dimensions, then center it
    // on a transparent background of the exact target size. This avoids sharp's `cover` cropping
    // which was changing framing for non-16:9 crops.
    async function resizeAndPadToWebp(inputBuffer, targetW, targetH) {
      if (!_sharp) throw new Error('sharp unavailable');
      // first resize to fit inside target while preserving aspect
      const resized = await _sharp(inputBuffer).rotate().resize({ width: targetW, height: targetH, fit: 'inside' }).toBuffer();
      const meta = await _sharp(resized).metadata();
      const left = Math.round((targetW - (meta.width || 0)) / 2);
      const top = Math.round((targetH - (meta.height || 0)) / 2);
      // create transparent background and composite the resized image centered
      const canvas = await _sharp({
        create: {
          width: targetW,
          height: targetH,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        }
      })
        .composite([{ input: resized, left, top }])
        .toFormat('webp')
        .toBuffer();
      return canvas;
    }

  const coverBuffer = await resizeAndPadToWebp(sourceBuffer, 1600, 900);
  const thumbBuffer = await resizeAndPadToWebp(sourceBuffer, 480, 270);

  // probe dimensions for original + generated images when sharp is available
  let sourceMeta = {};
  let coverMeta = {};
  let thumbMeta = {};
  try {
    if (_sharp) {
      sourceMeta = await _sharp(sourceBuffer).metadata();
      coverMeta = await _sharp(coverBuffer).metadata();
      thumbMeta = await _sharp(thumbBuffer).metadata();
    }
  } catch (e) {
    console.debug('[upload-image] metadata probe failed', e && e.message ? e.message : e);
    sourceMeta = coverMeta = thumbMeta = {};
  }

    // upload original and resized versions to Supabase Storage 'images' bucket
    // Note: bucket 'images' must exist and be public or configured for public access
    const uploadOriginal = await supabase.storage.from('images').upload(originalPath, buffer, { contentType: mimeType, upsert: false });
    if (uploadOriginal.error) throw uploadOriginal.error;

    const uploadCover = await supabase.storage.from('images').upload(coverPath, coverBuffer, { contentType: 'image/webp', upsert: false });
    if (uploadCover.error) throw uploadCover.error;

    const uploadThumb = await supabase.storage.from('images').upload(thumbPath, thumbBuffer, { contentType: 'image/webp', upsert: false });
    if (uploadThumb.error) throw uploadThumb.error;

    const originalUrl = supabase.storage.from('images').getPublicUrl(originalPath).data?.publicUrl;
    const coverUrl = supabase.storage.from('images').getPublicUrl(coverPath).data?.publicUrl;
    const thumbUrl = supabase.storage.from('images').getPublicUrl(thumbPath).data?.publicUrl;

    return res.status(200).json({
      original: originalUrl,
      cover: coverUrl,
      thumb: thumbUrl,
      dimensions: {
        original: { width: sourceMeta.width || null, height: sourceMeta.height || null },
        cover: { width: coverMeta.width || null, height: coverMeta.height || null },
        thumb: { width: thumbMeta.width || null, height: thumbMeta.height || null }
      }
    });
  } catch (err) {
    console.error('upload-image error', err);
    return res.status(500).json({ error: err?.message || String(err) });
  }
}
