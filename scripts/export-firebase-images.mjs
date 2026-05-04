import { mkdir, writeFile } from 'node:fs/promises';

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || 'AIzaSyD_Yvi_u5WixeTxuuEORgwFtxksAm7OUY4',
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || 'kukyying-f1c95.firebaseapp.com',
  projectId: process.env.FIREBASE_PROJECT_ID || 'kukyying-f1c95',
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'kukyying-f1c95.firebasestorage.app',
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '681899915263',
  appId: process.env.FIREBASE_APP_ID || '1:681899915263:web:4d64dcf4a9c57748ead9ca',
};

const SITE_URL = normalizeSiteUrl(process.env.SITE_URL || 'https://yingying-hou.netlify.app');
const GALLERY_URL = `${SITE_URL}/galerie.html`;
const COLLECTION_NAME = process.env.FIREBASE_GALLERY_COLLECTION || 'galerie';
const OUTPUT_JSON = process.env.FIREBASE_IMAGES_JSON || 'data/firebase-images.json';
const OUTPUT_SITEMAP = process.env.FIREBASE_IMAGES_SITEMAP || 'sitemap-firebase-images.xml';

function normalizeSiteUrl(value) {
  return String(value || '')
    .trim()
    .replace(/\/+$/, '') || 'https://yingying-hou.netlify.app';
}

function toPlainFirestoreValue(value) {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value?.toDate === 'function') return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(toPlainFirestoreValue);
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, toPlainFirestoreValue(item)]));
  }
  return String(value);
}

function cleanText(value, fallback = '') {
  return String(value || fallback || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function makeAlt(data, index) {
  const caption = cleanText(data.caption || data.legende || data.title || data.titre);
  const category = cleanText(data.categorie || data.category);
  if (caption) return caption;
  if (category) return `Photo de Yingying HOU - ${category}`;
  return `Photo de Yingying HOU ${index + 1}`;
}

function normalizeImageDocument(doc, index) {
  const data = doc.data ? doc.data() : doc;
  const plain = toPlainFirestoreValue(data);
  const url = cleanText(plain.url || plain.imageUrl || plain.imageURL || plain.downloadURL || plain.src);
  const caption = cleanText(plain.caption || plain.legende || plain.title || plain.titre || plain.alt);
  const category = cleanText(plain.categorie || plain.category);
  const ordre = Number(plain.ordre);

  return {
    id: doc.id || plain.id || `firebase-image-${index + 1}`,
    url,
    pageUrl: cleanText(plain.pageUrl || plain.pageURL || GALLERY_URL),
    title: caption || `Yingying HOU - photo ${index + 1}`,
    caption: caption || `Photo de Yingying HOU`,
    alt: makeAlt(plain, index),
    category,
    ordre: Number.isFinite(ordre) ? ordre : index + 1,
    storagePath: cleanText(plain.storagePath || plain.path || plain.fullPath),
    source: 'firebase-firestore',
  };
}

function escapeXml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildImageSitemap(images) {
  const blocks = images.map((image) => `  <url>\n    <loc>${escapeXml(image.pageUrl || GALLERY_URL)}</loc>\n    <image:image>\n      <image:loc>${escapeXml(image.url)}</image:loc>\n      <image:title>${escapeXml(image.title)}</image:title>\n      <image:caption>${escapeXml(image.caption || image.alt)}</image:caption>\n    </image:image>\n  </url>`).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${blocks}\n</urlset>\n`;
}

async function readWithClientSdk() {
  const [{ initializeApp }, { getFirestore, collection, getDocs, orderBy, query }] = await Promise.all([
    import('firebase/app'),
    import('firebase/firestore'),
  ]);

  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  const snapshot = await getDocs(query(collection(db, COLLECTION_NAME), orderBy('ordre', 'asc')));
  return snapshot.docs.map((doc, index) => normalizeImageDocument(doc, index));
}

async function readWithAdminSdk() {
  const admin = await import('firebase-admin');
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON manquant.');

  const serviceAccount = JSON.parse(serviceAccountJson);
  const app = admin.getApps().length
    ? admin.getApps()[0]
    : admin.initializeApp({ credential: admin.cert(serviceAccount) });

  const snapshot = await admin.getFirestore(app).collection(COLLECTION_NAME).orderBy('ordre', 'asc').get();
  return snapshot.docs.map((doc, index) => normalizeImageDocument(doc, index));
}

async function main() {
  const rawImages = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
    ? await readWithAdminSdk()
    : await readWithClientSdk();

  const images = rawImages
    .filter((image) => image.url && /^https?:\/\//i.test(image.url))
    .sort((a, b) => a.ordre - b.ordre);

  const payload = {
    generatedAt: new Date().toISOString(),
    siteUrl: SITE_URL,
    galleryUrl: GALLERY_URL,
    projectId: firebaseConfig.projectId,
    collection: COLLECTION_NAME,
    count: images.length,
    images,
  };

  await mkdir('data', { recursive: true });
  await writeFile(OUTPUT_JSON, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  await writeFile(OUTPUT_SITEMAP, buildImageSitemap(images), 'utf8');

  console.log(`Export Firebase terminé : ${images.length} image(s).`);
  console.log(`JSON : ${OUTPUT_JSON}`);
  console.log(`Sitemap images : ${OUTPUT_SITEMAP}`);
}

main().catch((error) => {
  console.error('Export Firebase impossible.');
  console.error(error);
  process.exitCode = 1;
});
