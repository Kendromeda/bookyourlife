import type { TranslationKey } from './en';

export const id: Record<TranslationKey, string> = {
  // Common
  'common.cancel': 'Batal',
  'common.save': 'Simpan',
  'common.done': 'Selesai',
  'common.back': 'Kembali',
  'common.continue': 'Lanjut',
  'common.finish': 'Selesai',
  'common.skip': 'Lewati',
  'common.delete': 'Hapus',
  'common.discard': 'Buang',
  'common.add': 'Tambah',
  'common.retry': 'Coba lagi',
  'common.loading': 'Memuat…',
  'common.tryAgain': 'Coba lagi',
  'common.signOut': 'Keluar',

  // Tabs
  'tabs.today': 'Hari Ini',
  'tabs.journal': 'Jurnal',
  'tabs.prompts': 'Pertanyaan',
  'tabs.more': 'Lainnya',

  // Today screen
  'today.heading': 'Hari Ini',
  'today.yesterday': 'Kemarin',
  'today.tomorrow': 'Besok',
  'today.newEntry': 'Entri baru',
  'today.emptyDay': 'Belum ada entri di hari ini.',
  'today.questionLoadError': 'Pertanyaan harian gagal dimuat.',
  'today.timelineEmpty':
    'Belum ada entri. Jawab pertanyaan hari ini untuk memulai.',

  // Journal
  'journal.title': 'Jurnal',
  'journal.tab.list': 'Daftar',
  'journal.tab.calendar': 'Kalender',
  'journal.tab.media': 'Media',
  'journal.tab.map': 'Peta',
  'journal.mediaEmptyTitle': 'Belum ada media',
  'journal.mediaEmptySub':
    'Media akan muncul di sini saat ditambahkan ke jurnal.',
  'journal.mapSoonTitle': 'Peta segera hadir',
  'journal.mapSoonSub':
    'Entri akan terpasang di peta saat fitur lokasi diaktifkan.',

  // Prompts
  'prompts.title': 'Pertanyaan',
  'prompts.recommended': 'Direkomendasikan',
  'prompts.packs': 'Paket Pertanyaan',
  'prompts.packMeta': '{count} pertanyaan',
  'prompts.packNotFound': 'Paket tidak ditemukan',

  // More
  'more.title': 'Lainnya',
  'more.signedInAs': 'Masuk sebagai',
  'more.section.yourBook': 'BUKUMU',
  'more.section.preferences': 'PREFERENSI',
  'more.section.account': 'AKUN',
  'more.row.generateBook': 'Buat Buku',
  'more.row.generateBookDetail':
    'Ubah entri jurnalmu menjadi buku siap cetak',
  'more.row.notifHour': 'Waktu pertanyaan harian',
  'more.row.language': 'Bahasa',
  'more.row.appearance': 'Tampilan',
  'more.row.appearanceDetail': 'Mengikuti sistem',
  'more.row.profile': 'Profil',
  'more.row.privacy': 'Privasi',
  'more.row.exportData': 'Ekspor data',
  'more.plan.free': 'Paket gratis',
  'more.plan.premium': 'Premium',

  // Entry editor
  'editor.titlePlaceholder': 'Judul (opsional)',
  'editor.bodyPlaceholder': 'Mulai menulis…',
  'editor.answering': 'Menjawab',
  'editor.toolbar.photos': 'Foto',
  'editor.toolbar.templates': 'Template',
  'editor.toolbar.ai': 'AI',
  'editor.toolbar.more': 'Lainnya…',
  'editor.sheet.addToEntry': 'Tambah ke entri',
  'editor.sheet.audio': 'Audio',
  'editor.sheet.location': 'Lokasi',
  'editor.sheet.tag': 'Tag',
  'editor.sheet.camera': 'Kamera',
  'editor.sheet.file': 'File',
  'editor.sheet.video': 'Video',
  'editor.aiTools.title': 'Alat Jurnal',
  'editor.aiTools.titles': 'Saran Judul',
  'editor.aiTools.prompts': 'Lanjutan Tulisan',
  'editor.aiTools.image': 'Buat Gambar',
  'editor.aiTools.highlights': 'Sorotan Entri',
  'editor.error.photoPermission': 'Izin foto diperlukan.',
  'editor.error.cameraPermission': 'Izin kamera diperlukan.',
  'editor.error.locationPermission': 'Izin lokasi ditolak.',
  'editor.error.locationFailed': 'Gagal mendapatkan lokasi',
  'editor.error.photoUploadFailed': 'Unggah foto gagal',
  'editor.error.videoUploadFailed': 'Unggah video gagal',
  'editor.error.audioUploadFailed': 'Unggah audio gagal',
  'editor.error.saveFailed': 'Gagal menyimpan entri',
  'editor.error.deleteFailed': 'Gagal menghapus entri',
  'editor.error.maxVideos': 'Hanya {max} video per entri.',
  'editor.error.maxAudios': 'Maksimum {max} voice note per entri.',
  'editor.error.templatesSoon': 'Template segera hadir',
  'editor.error.tagsSoon': 'Tag segera hadir',
  'editor.error.filesSoon': 'File segera hadir',
  'editor.locating': 'Mencari lokasi…',
  'editor.voiceNote': 'Voice note',
  'editor.video': 'Video',
  'editor.uploading': 'mengunggah…',
  'editor.transcribing': 'mentranskrip…',
  'editor.transcribeToJournal': 'Transkrip ke jurnal',
  'editor.transcribePremium': 'Transkrip · Premium',
  'editor.error.transcriptionFailed': 'Transkripsi audio gagal',
  'editor.error.transcriptionPremium': 'Transkripsi audio adalah fitur Premium.',

  // Modal header
  'modal.discardTitle': 'Buang perubahan?',
  'modal.discardMessage': 'Suntinganmu pada entri ini akan hilang.',
  'modal.deleteTitle': 'Hapus entri?',
  'modal.deleteMessage': 'Tindakan ini tidak bisa dibatalkan.',

  // Question card
  'question.answer': 'Jawab',
  'question.skip': 'Lewati',

  // Auth
  'auth.signIn.title': 'Selamat datang',
  'auth.signIn.email': 'Email',
  'auth.signIn.password': 'Kata sandi',
  'auth.signIn.button': 'Masuk',
  'auth.signIn.toggle': 'Belum punya akun? Daftar',
  'auth.signUp.title': 'Buat akun',
  'auth.signUp.button': 'Buat akun',
  'auth.signUp.verifyHint': 'Masukkan kode verifikasi yang dikirim ke {email}',
  'auth.signUp.code': 'Kode verifikasi',
  'auth.signUp.verify': 'Verifikasi',
  'auth.signUp.toggle': 'Sudah punya akun? Masuk',

  // Onboarding — shared / legacy keys still used by Profile screen
  'onboarding.profile.namePlaceholder': 'Namamu',
  'onboarding.gender.male': 'Laki-laki',
  'onboarding.gender.female': 'Perempuan',
  'onboarding.gender.non_binary': 'Non-biner',
  'onboarding.gender.prefer_not_to_say': 'Tidak ingin menjawab',
  'onboarding.birthday.year': 'Tahun',
  'onboarding.birthday.month': 'Bulan',
  'onboarding.birthday.day': 'Tanggal',
  'onboarding.goal.self_reflection': 'Refleksi diri',
  'onboarding.goal.mental_health': 'Kesehatan mental',
  'onboarding.goal.memory': 'Menyimpan kenangan',
  'onboarding.goal.creativity': 'Kreativitas',
  'onboarding.goal.other': 'Lainnya',
  'onboarding.error.save': 'Gagal menyimpan profil',

  // Onboarding · 01 Welcome
  'onboarding.welcome.eyebrow': 'Book My Life · Est. {year}',
  'onboarding.welcome.headingA': 'Hidupmu,',
  'onboarding.welcome.headingB': 'sebagai buku.',
  'onboarding.welcome.body':
    'Tulis sedikit setiap hari. Kami jilid menjadi buku — diilustrasi, dicetak, sampul keras — di akhir setiap tahun.',
  'onboarding.welcome.begin': 'Mulai volumemu',
  'onboarding.welcome.haveAccount': 'Saya sudah punya akun',

  // Onboarding · 02 Name
  'onboarding.name.eyebrow': 'Langkah satu · Atribusi',
  'onboarding.name.title': 'Nama apa yang akan tertulis di sampul?',
  'onboarding.name.body':
    'Bisa diubah nanti, atau pakai nama pena. Kami tidak akan membagikannya.',
  'onboarding.name.label': 'Namamu',
  'onboarding.name.previewEyebrow': 'Akan tampak seperti ini',
  'onboarding.name.previewVolume': 'Volume Satu · {year}',
  'onboarding.name.previewTitle': 'Tahun aku belajar mendengarkan',
  'onboarding.name.previewBy': 'oleh {name}',
  'onboarding.name.previewBlank': 'namamu',
  'onboarding.name.previewCaption':
    'Judul buku disusun dari entrimu — bisa kamu ganti nanti.',

  // Onboarding · 03 Intent (multi-select; local-only)
  'onboarding.intent.eyebrow': 'Langkah dua · Niat',
  'onboarding.intent.title': 'Apa yang ingin kamu tulis?',
  'onboarding.intent.body':
    'Pilih semua yang terasa pas. Kami akan menyesuaikan pertanyaan yang muncul.',
  'onboarding.intent.option.daily': 'Mencatat keseharian',
  'onboarding.intent.option.trip': 'Mengenang perjalanan atau satu tahun',
  'onboarding.intent.option.feelings': 'Mengolah perasaan',
  'onboarding.intent.option.chapter':
    'Menandai babak — kelahiran, kehilangan, pindah',
  'onboarding.intent.option.writer': 'Menjadi penulis yang lebih jujur',
  'onboarding.intent.option.kids': 'Meninggalkan sesuatu untuk anak-anakku',
  'onboarding.intent.selected': '{count} terpilih',

  // Onboarding · 04 Prompt packs (multi-select; local-only)
  'onboarding.packs.eyebrow': 'Langkah tiga · Pertanyaan',
  'onboarding.packs.title': 'Jenis pertanyaan apa yang kamu inginkan?',
  'onboarding.packs.body':
    'Pertanyaan baru datang setiap pagi, diambil dari paket yang kamu aktifkan.',
  'onboarding.packs.featuredEyebrow': 'Cicipi · Refleksi',
  'onboarding.packs.featuredQuestion':
    'Apa yang kamu tinggalkan tanpa kamu sadari?',
  'onboarding.packs.subtle':
    'Paket bisa diubah kapan saja di tab Pertanyaan',
  'onboarding.packs.meta': '{count} pertanyaan · {desc}',
  'onboarding.packs.pack.reflection.desc': 'Berhenti dan lihat ke dalam diri',
  'onboarding.packs.pack.gratitude.desc': 'Perhatikan hal-hal kecil yang baik',
  'onboarding.packs.pack.aboutMe.desc': 'Potret tentang siapa kamu',
  'onboarding.packs.pack.mindfulness.desc': 'Masuk ke momen ini',
  'onboarding.packs.pack.creativity.desc': 'Regangkan imajinasimu',

  // Onboarding · 05 Rhythm
  'onboarding.rhythm.eyebrow': 'Langkah empat · Ritme',
  'onboarding.rhythm.title': 'Kapan kamu menulis paling lancar?',
  'onboarding.rhythm.body':
    'Kami akan kirim satu pengingat lembut. Hanya satu — tidak lebih.',
  'onboarding.rhythm.morning': 'Pagi',
  'onboarding.rhythm.midday': 'Siang',
  'onboarding.rhythm.evening': 'Malam',
  'onboarding.rhythm.remindAt': 'Ingatkan jam',
  'onboarding.rhythm.everyMorning': 'SETIAP PAGI',
  'onboarding.rhythm.everyMidday': 'SETIAP SIANG',
  'onboarding.rhythm.everyEvening': 'SETIAP MALAM',
  'onboarding.rhythm.onTheseDays': 'Di hari-hari ini',
  'onboarding.rhythm.notifOn': 'AKTIF',

  // Onboarding · 06 Likeness
  'onboarding.likeness.eyebrow': 'Langkah lima · Wajah',
  'onboarding.likeness.title':
    'Pinjamkan wajahmu, kami akan ilustrasikan bab-babmu.',
  'onboarding.likeness.body':
    'Tiga selfie yang jelas sudah cukup. Foto tetap privat, hanya untuk menggambarmu.',
  'onboarding.likeness.slotCounter': '{current}/{total}',
  'onboarding.likeness.guide.title': 'Tips foto terbaik',
  'onboarding.likeness.guide.front':
    'Wajah lurus, pencahayaan baik, tanpa kacamata hitam',
  'onboarding.likeness.guide.range': 'Ragam ekspresi membuat hasil lebih kaya',
  'onboarding.likeness.guide.refresh':
    'Bisa diperbarui kapan saja di Pengaturan',
  'onboarding.likeness.encrypted': 'Terenkripsi end-to-end · tidak dijual',
  'onboarding.likeness.cta.addThree': 'Tambah tiga foto',
  'onboarding.likeness.cta.addMore': 'Tambah {remaining} lagi',
  'onboarding.likeness.cta.continue': 'Lanjut',
  'onboarding.likeness.skip': 'Lewati — saya tambahkan nanti',

  // Onboarding · 07 Ready
  'onboarding.ready.eyebrowNamed': 'Kamu siap, {name}',
  'onboarding.ready.eyebrow': 'Kamu siap',
  'onboarding.ready.titleA': 'Halaman satu',
  'onboarding.ready.titleB': 'menanti.',
  'onboarding.ready.badge.packs': '{count} paket',
  'onboarding.ready.badge.packs.one': '1 paket',
  'onboarding.ready.badge.packsSubOne': '{first}',
  'onboarding.ready.badge.packsSubMany': '{first} +{rest}',
  'onboarding.ready.badge.reminder': 'Pengingat',
  'onboarding.ready.badge.photo': '{count} foto',
  'onboarding.ready.badge.photos': '{count} foto',
  'onboarding.ready.badge.photosSub': 'Untuk wajah',
  'onboarding.ready.firstPrompt': 'Pertanyaan pertamamu',
  'onboarding.ready.firstPromptText':
    'Apa yang benar hari ini yang setahun lalu belum benar?',
  'onboarding.ready.beginWriting': 'Mulai menulis',
  'onboarding.ready.takeMeToday': 'Bawa saya ke hari ini',

  // Profile screen
  'profile.title': 'Profil',
  'profile.displayName': 'Nama tampilan',
  'profile.gender': 'Gender',
  'profile.birthday': 'Tanggal lahir',
  'profile.goal': 'Tujuan menulis jurnal',
  'profile.facePhoto': 'Foto wajah',
  'profile.changePhoto': 'Ganti foto',
  'profile.saved': 'Tersimpan',

  // Book viewer
  'book.viewer.spreadOf': 'Halaman {current} dari {total}',
  'book.viewer.saving': 'Menyimpan',
  'book.viewer.tweaks.title': 'Sesuaikan',
  'book.viewer.tweaks.paper': 'Kertas',
  'book.viewer.tweaks.type': 'Tipografi',
  'book.viewer.tweaks.ribbon': 'Pita',
  'book.viewer.tweaks.stage': 'Latar',
  'book.viewer.tweaks.illustrations': 'Ilustrasi',
  'book.viewer.tweaks.illustrationsHint': 'Tampilkan halaman foto & frontispiece.',
  'book.viewer.tweaks.paperOption.cream': 'Krem',
  'book.viewer.tweaks.paperOption.ivory': 'Gading',
  'book.viewer.tweaks.paperOption.white': 'Terang',
  'book.viewer.tweaks.paperOption.slate': 'Batu',
  'book.viewer.tweaks.ribbonOption.terracotta': 'Terakota',
  'book.viewer.tweaks.ribbonOption.ink': 'Tinta',
  'book.viewer.tweaks.ribbonOption.forest': 'Hutan',
  'book.viewer.tweaks.ribbonOption.wine': 'Anggur',
  'book.viewer.tweaks.stageOption.ink': 'Tinta',
  'book.viewer.tweaks.stageOption.walnut': 'Kayu walnut',
  'book.viewer.tweaks.stageOption.slate': 'Batu',
  'book.viewer.tweaks.stageOption.paper': 'Kertas',

  // Appearance screen
  'appearance.title': 'Tampilan',
  'appearance.section': 'Tema',
  'appearance.light': 'Terang',
  'appearance.lightDetail': 'Kertas krem · tampilan editorial default.',
  'appearance.dark': 'Gelap',
  'appearance.darkDetail': 'Latar tinta untuk membaca di tempat redup.',
  'appearance.note':
    'Pilihanmu tersimpan di perangkat ini dan tidak mengikuti pengaturan sistem.',

  // Privacy screen
  'privacy.title': 'Privasi',
  'privacy.body':
    'Entri jurnalmu disimpan secara privat dan hanya digunakan untuk merangkai refleksi harian. Kami tidak pernah membagikan isi jurnalmu ke pihak ketiga. Voice note tidak ditranskripsikan secara default; transkripsi hanya dipakai saat kamu mengaktifkannya untuk penulisan entri Premium atau preview buku.',
  'privacy.deleteAccount': 'Hapus akun',
  'privacy.deleteTitle': 'Hapus akunmu?',
  'privacy.deleteMessage':
    'Tindakan ini akan menghapus permanen seluruh entri, foto, dan audio. Tidak bisa dibatalkan.',
  'privacy.deleteFailed': 'Tidak bisa menghapus akun. Coba lagi.',

  // Export
  'export.preparing': 'Menyiapkan ekspor…',
  'export.failed': 'Ekspor gagal. Coba lagi.',
  'export.success': 'Ekspor siap dibagikan',
  'export.unsupported': 'Fitur berbagi tidak tersedia di perangkat ini.',
  'export.fileName': 'book-your-life-ekspor.json',

  // Stats / progress bar
  'progress.title': 'Perjalanan Refleksi',
  'progress.streak': 'streak {count} hari',
  'progress.streakSingular': 'streak 1 hari',
  'progress.entriesIn30': '{count} entri dalam 30 hari terakhir',
  'progress.startStreak': 'Menulislah hari ini untuk mulai streak',
};
