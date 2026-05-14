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

  // Onboarding
  'onboarding.step': 'Langkah {current} dari {total}',
  'onboarding.profile.title': 'Yuk siapkan akunmu',
  'onboarding.profile.subtitle':
    'Foto wajahmu membantu kami menggambar ilustrasi yang mirip denganmu di bab buku.',
  'onboarding.profile.addPhoto': '+ Tambah foto wajah',
  'onboarding.profile.namePlaceholder': 'Namamu',
  'onboarding.gender.title': 'Bagaimana kamu mengidentifikasi diri?',
  'onboarding.gender.subtitle':
    'Membantu kami menyesuaikan refleksi. Bisa diubah nanti.',
  'onboarding.gender.male': 'Laki-laki',
  'onboarding.gender.female': 'Perempuan',
  'onboarding.gender.non_binary': 'Non-biner',
  'onboarding.gender.prefer_not_to_say': 'Tidak ingin menjawab',
  'onboarding.birthday.title': 'Kapan kamu lahir?',
  'onboarding.birthday.subtitle':
    'Usia membantu kami menyesuaikan nada refleksi.',
  'onboarding.birthday.year': 'Tahun',
  'onboarding.birthday.month': 'Bulan',
  'onboarding.birthday.day': 'Tanggal',
  'onboarding.goal.title': 'Apa yang membawamu ke sini?',
  'onboarding.goal.subtitle': 'Pilih yang paling sesuai.',
  'onboarding.goal.self_reflection': 'Refleksi diri',
  'onboarding.goal.mental_health': 'Kesehatan mental',
  'onboarding.goal.memory': 'Menyimpan kenangan',
  'onboarding.goal.creativity': 'Kreativitas',
  'onboarding.goal.other': 'Lainnya',
  'onboarding.language.title': 'Pilih bahasa',
  'onboarding.language.subtitle':
    'Bisa diubah kapan saja di Lainnya → Bahasa.',
  'onboarding.error.required': 'Pilih salah satu opsi untuk melanjutkan.',
  'onboarding.error.save': 'Gagal menyimpan profil',

  // Profile screen
  'profile.title': 'Profil',
  'profile.displayName': 'Nama tampilan',
  'profile.gender': 'Gender',
  'profile.birthday': 'Tanggal lahir',
  'profile.goal': 'Tujuan menulis jurnal',
  'profile.facePhoto': 'Foto wajah',
  'profile.changePhoto': 'Ganti foto',
  'profile.saved': 'Tersimpan',

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
    'Entri jurnalmu disimpan secara privat dan hanya digunakan untuk merangkai refleksi harian. Kami tidak pernah membagikan isi jurnalmu ke pihak ketiga. Voice note ditranskripsikan via OpenAI dan dibuang setelah diproses.',
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
