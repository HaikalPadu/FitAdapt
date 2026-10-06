/* Loaded before styles to apply the saved appearance without a theme flash. */
(() => {
  const read = key => { try { return localStorage.getItem(key); } catch { return null; } };
  const write = (key, value) => { try { localStorage.setItem(key, value); } catch { /* Private storage may be unavailable. */ } };
  let language = read('fitadapt_language') === 'en' ? 'en' : 'ms';
  let theme = read('fitadapt_theme') === 'light' ? 'light' : 'dark';
  const dictionary = window.FitAdaptEnglish;
  // A separate allowlist prevents administrator-authored exercise copy from being
  // mistaken for interface labels (for example, an instruction simply named Rehat).
  const systemKeys = new Set([
    'Pilih tarikh hari ini atau sebelumnya.','Semak nilai label bagi setiap 100 g.','Pilih makanan atau masukkan label makanan.','Makanan tidak ditemui.','Rekod makanan tidak ditemui.',
    'Hari rehat','Seluruh Badan','Atas Badan (Push / Pull)','Bawah Badan','Atas Badan (Push)','Atas Badan (Pull)','Bawah Badan (Squat)','Bawah Badan (Hinge)',
    'Pelan pertama dijana mengikut profil anda.','Pelan dilaraskan mengikut perubahan profil.','Profil dikemas kini. Pelan baharu bermula esok.',
    'Mulakan dengan posisi stabil. Lakukan pergerakan secara terkawal, hembus nafas ketika mengangkat dan elakkan mengunci sendi. Berhenti jika terasa sakit.',
    'Beban dikekalkan kerana usaha tinggi (RPE 9 atau lebih).','Beban dikurangkan kerana sasaran rep tidak dicapai dua sesi berturut-turut.',
    'Beban dinaikkan kerana semua rep dicapai dengan RPE 7 atau kurang dua sesi berturut-turut.','Kemajuan mendatar tiga sesi. Cuba senaman alternatif atau minggu latihan ringan.',
    'Sesi kekal terlepas. Fokus latihan dibawa ke minggu seterusnya.','Dua sesi berturut-turut terlepas. Satu set dikurangkan bagi setiap senaman minggu depan.',
    'Pilih antara 2 hingga 6 hari latihan.','Tiada senaman sesuai untuk jadual dan limitasi ini. Pilih hari berselang, ubah akses peralatan, atau hubungi pentadbir untuk menambah senaman.',
    'Akaun berjaya didaftarkan. Sila log masuk untuk meneruskan.','Masukkan alamat e-mel yang sah.','E-mel maksimum 150 aksara.',
    'Kata laluan minimum 8 aksara.','Kata laluan maksimum 72 aksara.','Kata laluan terlalu panjang.','Masukkan nama penuh (maksimum 100 aksara).',
    'Pengesahan kata laluan tidak sepadan.','Sila setuju dengan terma dan dasar privasi.','Permintaan gagal. Sila cuba lagi.',
    'E-mel atau kata laluan tidak tepat.','Sila log masuk untuk meneruskan.','Sesi borang tidak sah. Muat semula halaman.','Anda tidak mempunyai akses.',
    'Permintaan tidak dibenarkan.','Laluan tidak ditemui.','Senaman tidak dipadam untuk melindungi sejarah. Gunakan Nyahaktif.',
    'Anda tidak boleh menggantung atau memadam akaun sendiri.','Akaun tidak ditemui.','Sekurang-kurangnya seorang pentadbir aktif diperlukan.',
    'Terima kasih atas maklum balas anda!','Medan ini wajib.','Teks terlalu panjang.','Masukkan minit dalam nombor bulat.','Minimum 15 minit.','Maksimum 120 minit.',
    'Hari tidak boleh berulang.','Gunakan URL HTTPS.','Rep maksimum mesti melebihi minimum.','Format permintaan tidak sah.','Permintaan terlalu besar.',
    'Sila semak maklumat yang dimasukkan.','Rekod ini telah wujud. Gunakan e-mel atau nama yang berbeza.','Ralat pelayan. Sila cuba lagi.',
    'Terlalu banyak cubaan. Cuba lagi selepas 15 minit.','Akaun anda digantung. Sila hubungi pentadbir.','Anda telah log keluar.','Kata laluan lama tidak tepat.',
    'Kata laluan berjaya ditukar.','Profil telah dilengkapkan. Gunakan tetapan profil.','Tarikh mula tidak boleh sebelum hari ini.','Sesi tidak ditemui.',
    'Log tidak ditemui.','Log dikunci selepas 24 jam.','Sesi hanya boleh dimulakan pada hari latihan yang dijadualkan.','Senaman tidak ditemui.','Nombor set melebihi sasaran.'
  ]);
  const escapeRegex = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp('(?<![\\p{L}\\p{N}_-])(?:' + Object.keys(dictionary).sort((a,b)=>b.length-a.length).map(escapeRegex).join('|') + ')(?![\\p{L}\\p{N}_-])', 'gu');
  // Called only for source-authored fragments, never on assembled markup or user data.
  const translate = text => language === 'en' ? String(text).replace(pattern, key => dictionary[key]) : String(text);
  function text(source, ...values) {
    if (Array.isArray(source)) return source.map((part,i) => translate(part) + (i < values.length ? values[i] : '')).join('');
    return translate(source);
  }
  function system(source) {
    const value = String(source ?? '');
    if (language !== 'en') return value;
    if (systemKeys.has(value)) return dictionary[value];
    const missed = value.match(/^Sesi (.+) pada (\d{4}-\d{2}-\d{2}) terlepas\.$/);
    if (missed) return `Session ${system(missed[1])} on ${missed[2]} was missed.`;
    const rescheduled = value.match(/^Sesi terlepas dijadualkan semula pada (\d{4}-\d{2}-\d{2})\.$/);
    if (rescheduled) return `The missed session was rescheduled to ${rescheduled[1]}.`;
    return value;
  }
  function apply() {
    document.documentElement.lang = language;
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#f5f6fc' : '#0c101c');
    document.title = text('FitAdapt — Latih ikut rentak kamu');
    document.querySelectorAll('[data-preference=language]').forEach(el => { el.value = language; });
    document.querySelectorAll('[data-preference=theme]').forEach(el => {
      el.value = theme;
      el.options[0].textContent = text('Gelap'); el.options[1].textContent = text('Cerah');
    });
    document.querySelectorAll('[data-preference-label]').forEach(el => { el.textContent = text(el.dataset.preferenceLabel); });
    const skip = document.querySelector('.skip-link'); if (skip) skip.textContent = text('Langkau ke kandungan');
  }
  function set(kind, value) {
    if (kind === 'language' && ['ms','en'].includes(value)) language = value;
    else if (kind === 'theme' && ['dark','light'].includes(value)) theme = value;
    else return;
    write('fitadapt_' + kind, value); apply();
    window.dispatchEvent(new CustomEvent('fitadapt:preferences', { detail: { kind, language, theme } }));
  }
  function controls() {
    return `<div class="display-preferences"><label><span data-preference-label="Bahasa">${text('Bahasa')}</span><select data-preference="language"><option value="ms" ${language==='ms'?'selected':''}>Bahasa Melayu</option><option value="en" ${language==='en'?'selected':''}>English</option></select></label><label><span data-preference-label="Tema">${text('Tema')}</span><select data-preference="theme"><option value="dark" ${theme==='dark'?'selected':''}>${text('Gelap')}</option><option value="light" ${theme==='light'?'selected':''}>${text('Cerah')}</option></select></label></div>`;
  }
  window.FitAdaptPreferences = { text, system, controls, set, get language(){return language;}, get theme(){return theme;} };
  document.addEventListener('change', e => { if (e.target.matches('[data-preference]')) set(e.target.dataset.preference, e.target.value); });
  window.addEventListener('storage', e => { if (e.key === 'fitadapt_language') set('language', e.newValue); if (e.key === 'fitadapt_theme') set('theme', e.newValue); });
  apply();
  document.addEventListener('DOMContentLoaded', () => {
    const toolbar = document.createElement('div'); toolbar.id = 'display-toolbar'; toolbar.innerHTML = controls(); document.body.prepend(toolbar); apply();
    const loading = document.querySelector('#main.loading'); if (loading) loading.textContent = text('Memuatkan FitAdapt…');
  });
})();
