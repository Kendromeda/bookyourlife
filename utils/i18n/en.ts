/**
 * English string dictionary. Keys use dot notation and stay flat
 * (no nested objects) so lookups are O(1) and TypeScript can derive a
 * literal-string union from the keyset.
 */
export const en = {
  // Common
  'common.cancel': 'Cancel',
  'common.save': 'Save',
  'common.done': 'Done',
  'common.back': 'Back',
  'common.continue': 'Continue',
  'common.finish': 'Finish',
  'common.skip': 'Skip',
  'common.delete': 'Delete',
  'common.discard': 'Discard',
  'common.add': 'Add',
  'common.retry': 'Try again',
  'common.loading': 'Loading…',
  'common.tryAgain': 'Try again',
  'common.signOut': 'Sign out',

  // Tabs
  'tabs.today': 'Today',
  'tabs.journal': 'Journal',
  'tabs.prompts': 'Prompts',
  'tabs.more': 'More',

  // Today screen
  'today.heading': 'Today',
  'today.yesterday': 'Yesterday',
  'today.tomorrow': 'Tomorrow',
  'today.newEntry': 'New entry',
  'today.emptyDay': 'No entries on this day yet.',
  'today.questionLoadError': 'Daily question could not load.',
  'today.timelineEmpty': "No entries yet. Answer today's question to get started.",

  // Journal
  'journal.title': 'Journal',
  'journal.tab.list': 'List',
  'journal.tab.calendar': 'Calendar',
  'journal.tab.media': 'Media',
  'journal.tab.map': 'Map',
  'journal.mediaEmptyTitle': 'Empty Media',
  'journal.mediaEmptySub': 'Media will appear here when added to your journal',
  'journal.mapSoonTitle': 'Map coming soon',
  'journal.mapSoonSub': 'Entries will plot on a map once location capture is enabled.',

  // Prompts
  'prompts.title': 'Prompts',
  'prompts.recommended': 'Recommended',
  'prompts.packs': 'Prompt Packs',
  'prompts.packMeta': '{count} prompts',
  'prompts.packNotFound': 'Pack not found',

  // More
  'more.title': 'More',
  'more.signedInAs': 'Signed in as',
  'more.section.yourBook': 'YOUR BOOK',
  'more.section.preferences': 'PREFERENCES',
  'more.section.account': 'ACCOUNT',
  'more.row.generateBook': 'Generate Book',
  'more.row.generateBookDetail': 'Turn your entries into a printable book',
  'more.row.notifHour': 'Daily question time',
  'more.row.language': 'Language',
  'more.row.appearance': 'Appearance',
  'more.row.appearanceDetail': 'System default',
  'more.row.profile': 'Profile',
  'more.row.privacy': 'Privacy',
  'more.row.exportData': 'Export data',
  'more.plan.free': 'Free plan',
  'more.plan.premium': 'Premium',

  // Entry editor
  'editor.titlePlaceholder': 'Title (optional)',
  'editor.bodyPlaceholder': 'Start writing…',
  'editor.answering': 'Answering',
  'editor.toolbar.photos': 'Photos',
  'editor.toolbar.templates': 'Templates',
  'editor.toolbar.ai': 'AI',
  'editor.toolbar.more': 'More…',
  'editor.sheet.addToEntry': 'Add to entry',
  'editor.sheet.audio': 'Audio',
  'editor.sheet.location': 'Location',
  'editor.sheet.tag': 'Tag',
  'editor.sheet.camera': 'Camera',
  'editor.sheet.file': 'File',
  'editor.sheet.video': 'Video',
  'editor.aiTools.title': 'Journaling Tools',
  'editor.aiTools.titles': 'Title Suggestions',
  'editor.aiTools.prompts': 'Writing Prompts',
  'editor.aiTools.image': 'Generate Image',
  'editor.aiTools.highlights': 'Entry Highlights',
  'editor.error.photoPermission': 'Photo permission required.',
  'editor.error.cameraPermission': 'Camera permission required.',
  'editor.error.locationPermission': 'Location permission was denied.',
  'editor.error.locationFailed': 'Failed to get location',
  'editor.error.photoUploadFailed': 'Photo upload failed',
  'editor.error.videoUploadFailed': 'Video upload failed',
  'editor.error.audioUploadFailed': 'Audio upload failed',
  'editor.error.saveFailed': 'Failed to save entry',
  'editor.error.deleteFailed': 'Failed to delete entry',
  'editor.error.maxVideos': 'Only {max} video allowed per entry.',
  'editor.error.maxAudios': 'Maximum {max} voice notes per entry.',
  'editor.error.templatesSoon': 'Templates coming soon',
  'editor.error.tagsSoon': 'Tags coming soon',
  'editor.error.filesSoon': 'Files coming soon',
  'editor.locating': 'Locating…',
  'editor.voiceNote': 'Voice note',
  'editor.video': 'Video',
  'editor.uploading': 'uploading…',
  'editor.transcribing': 'transcribing…',
  'editor.transcribeToJournal': 'Transcribe to journal',
  'editor.transcribePremium': 'Transcribe · Premium',
  'editor.error.transcriptionFailed': 'Audio transcription failed',
  'editor.error.transcriptionPremium': 'Audio transcription is a Premium feature.',

  // Modal header
  'modal.discardTitle': 'Discard unsaved changes?',
  'modal.discardMessage': 'Your edits to this entry will be lost.',
  'modal.deleteTitle': 'Delete entry?',
  'modal.deleteMessage': 'This cannot be undone.',

  // Question card
  'question.answer': 'Answer',
  'question.skip': 'Skip',

  // Auth
  'auth.signIn.title': 'Welcome back',
  'auth.signIn.email': 'Email',
  'auth.signIn.password': 'Password',
  'auth.signIn.button': 'Sign in',
  'auth.signIn.toggle': "Don't have an account? Create one",
  'auth.signUp.title': 'Create account',
  'auth.signUp.button': 'Create account',
  'auth.signUp.verifyHint': 'Enter the verification code sent to {email}',
  'auth.signUp.code': 'Verification code',
  'auth.signUp.verify': 'Verify',
  'auth.signUp.toggle': 'Already have an account? Sign in',

  // Onboarding — shared / legacy keys still used by Profile screen
  'onboarding.profile.namePlaceholder': 'Your name',
  'onboarding.gender.male': 'Male',
  'onboarding.gender.female': 'Female',
  'onboarding.gender.non_binary': 'Non-binary',
  'onboarding.gender.prefer_not_to_say': 'Prefer not to say',
  'onboarding.birthday.year': 'Year',
  'onboarding.birthday.month': 'Month',
  'onboarding.birthday.day': 'Day',
  'onboarding.goal.self_reflection': 'Self-reflection',
  'onboarding.goal.mental_health': 'Mental health',
  'onboarding.goal.memory': 'Memory keeping',
  'onboarding.goal.creativity': 'Creativity',
  'onboarding.goal.other': 'Other',
  'onboarding.error.save': 'Failed to save profile',

  // Onboarding · 01 Welcome
  'onboarding.welcome.eyebrow': 'Book My Life · Est. {year}',
  'onboarding.welcome.headingA': 'Your life,',
  'onboarding.welcome.headingB': 'as a book.',
  'onboarding.welcome.body':
    'Write a little each day. We bind it — illustrated, printed, hardbound — at the end of every year.',
  'onboarding.welcome.begin': 'Begin your volume',
  'onboarding.welcome.haveAccount': 'I already have an account',

  // Onboarding · 02 Name
  'onboarding.name.eyebrow': 'Step one · Attribution',
  'onboarding.name.title': 'What name should appear on the spine?',
  'onboarding.name.body':
    "You can change this later, or use a pen name. We won't share it.",
  'onboarding.name.label': 'Your name',
  'onboarding.name.previewEyebrow': 'How it will appear',
  'onboarding.name.previewVolume': 'Volume One · {year}',
  'onboarding.name.previewTitle': 'The year I learned to listen',
  'onboarding.name.previewBy': 'by {name}',
  'onboarding.name.previewBlank': 'your name',
  'onboarding.name.previewCaption':
    "The book title is drafted from your entries — yours to rename when it's ready.",

  // Onboarding · 03 Intent (multi-select; local-only)
  'onboarding.intent.eyebrow': 'Step two · Intention',
  'onboarding.intent.title': 'What are you hoping to write toward?',
  'onboarding.intent.body':
    "Pick all that ring true. We'll tune the prompts you see.",
  'onboarding.intent.option.daily': 'Capture daily life',
  'onboarding.intent.option.trip': 'Remember a trip or year',
  'onboarding.intent.option.feelings': 'Process feelings',
  'onboarding.intent.option.chapter': 'Mark a chapter — birth, loss, move',
  'onboarding.intent.option.writer': 'Become a more honest writer',
  'onboarding.intent.option.kids': 'Leave something for my kids',
  'onboarding.intent.selected': '{count} selected',

  // Onboarding · 04 Prompt packs (multi-select; local-only)
  'onboarding.packs.eyebrow': 'Step three · Prompts',
  'onboarding.packs.title': 'Which kinds of questions do you want?',
  'onboarding.packs.body':
    'A new prompt arrives each morning, drawn from the packs you keep on.',
  'onboarding.packs.featuredEyebrow': 'A taste · Reflection',
  'onboarding.packs.featuredQuestion':
    "What is something you've outgrown without noticing?",
  'onboarding.packs.subtle': 'You can change packs anytime in Prompts',
  'onboarding.packs.meta': '{count} prompts · {desc}',
  'onboarding.packs.pack.reflection.desc': 'Pause and look inward',
  'onboarding.packs.pack.gratitude.desc': 'Notice the small good things',
  'onboarding.packs.pack.aboutMe.desc': 'A portrait of who you are',
  'onboarding.packs.pack.mindfulness.desc': 'Drop into the present',
  'onboarding.packs.pack.creativity.desc': 'Stretch your imagination',

  // Onboarding · 05 Rhythm
  'onboarding.rhythm.eyebrow': 'Step four · Rhythm',
  'onboarding.rhythm.title': 'When do you write best?',
  'onboarding.rhythm.body':
    "We'll send one gentle reminder. Just one — never more.",
  'onboarding.rhythm.morning': 'Morning',
  'onboarding.rhythm.midday': 'Midday',
  'onboarding.rhythm.evening': 'Evening',
  'onboarding.rhythm.remindAt': 'Remind me at',
  'onboarding.rhythm.everyMorning': 'EVERY MORNING',
  'onboarding.rhythm.everyMidday': 'EVERY MIDDAY',
  'onboarding.rhythm.everyEvening': 'EVERY EVENING',
  'onboarding.rhythm.onTheseDays': 'On these days',
  'onboarding.rhythm.notifOn': 'ON',

  // Onboarding · 06 Likeness
  'onboarding.likeness.eyebrow': 'Step five · Likeness',
  'onboarding.likeness.title':
    "Lend us your likeness, and we'll illustrate your chapters.",
  'onboarding.likeness.body':
    'Three clear selfies are enough. Photos stay private, used only to draw you.',
  'onboarding.likeness.slotCounter': '{current}/{total}',
  'onboarding.likeness.guide.title': 'What works best',
  'onboarding.likeness.guide.front': 'Front-facing, well lit, no sunglasses',
  'onboarding.likeness.guide.range':
    'A range of expressions tells a fuller story',
  'onboarding.likeness.guide.refresh':
    'You can refresh these any time in Settings',
  'onboarding.likeness.encrypted': 'End-to-end encrypted · never sold',
  'onboarding.likeness.cta.addThree': 'Add three photos',
  'onboarding.likeness.cta.addMore': 'Add {remaining} more',
  'onboarding.likeness.cta.continue': 'Continue',
  'onboarding.likeness.skip': "Skip — I'll add later",

  // Onboarding · 07 Ready
  'onboarding.ready.eyebrowNamed': "You're ready, {name}",
  'onboarding.ready.eyebrow': "You're ready",
  'onboarding.ready.titleA': 'Page one',
  'onboarding.ready.titleB': 'is waiting.',
  'onboarding.ready.badge.packs': '{count} packs',
  'onboarding.ready.badge.packs.one': '1 pack',
  'onboarding.ready.badge.packsSubOne': '{first}',
  'onboarding.ready.badge.packsSubMany': '{first} +{rest}',
  'onboarding.ready.badge.reminder': 'Reminder',
  'onboarding.ready.badge.photo': '{count} photo',
  'onboarding.ready.badge.photos': '{count} photos',
  'onboarding.ready.badge.photosSub': 'For likeness',
  'onboarding.ready.firstPrompt': 'Your first prompt',
  'onboarding.ready.firstPromptText':
    "What is true about today that wasn't true a year ago?",
  'onboarding.ready.beginWriting': 'Begin writing',
  'onboarding.ready.takeMeToday': 'Take me to today instead',

  // Profile screen
  'profile.title': 'Profile',
  'profile.displayName': 'Display name',
  'profile.gender': 'Gender',
  'profile.birthday': 'Birthday',
  'profile.goal': 'Why you journal',
  'profile.facePhoto': 'Face photo',
  'profile.changePhoto': 'Change photo',
  'profile.saved': 'Saved',

  // Book viewer
  'book.viewer.spreadOf': 'Spread {current} of {total}',
  'book.viewer.saving': 'Saving',
  'book.viewer.tweaks.title': 'Tweaks',
  'book.viewer.tweaks.paper': 'Paper',
  'book.viewer.tweaks.type': 'Type',
  'book.viewer.tweaks.ribbon': 'Ribbon',
  'book.viewer.tweaks.stage': 'Stage',
  'book.viewer.tweaks.illustrations': 'Illustrations',
  'book.viewer.tweaks.illustrationsHint': 'Show photo plates and frontispiece.',
  'book.viewer.tweaks.paperOption.cream': 'Cream',
  'book.viewer.tweaks.paperOption.ivory': 'Ivory',
  'book.viewer.tweaks.paperOption.white': 'Bright',
  'book.viewer.tweaks.paperOption.slate': 'Slate',
  'book.viewer.tweaks.ribbonOption.terracotta': 'Terracotta',
  'book.viewer.tweaks.ribbonOption.ink': 'Ink',
  'book.viewer.tweaks.ribbonOption.forest': 'Forest',
  'book.viewer.tweaks.ribbonOption.wine': 'Wine',
  'book.viewer.tweaks.stageOption.ink': 'Ink',
  'book.viewer.tweaks.stageOption.walnut': 'Walnut',
  'book.viewer.tweaks.stageOption.slate': 'Slate',
  'book.viewer.tweaks.stageOption.paper': 'Paper',

  // Appearance screen
  'appearance.title': 'Appearance',
  'appearance.section': 'Theme',
  'appearance.light': 'Light',
  'appearance.lightDetail': 'Cream paper · the editorial default.',
  'appearance.dark': 'Dark',
  'appearance.darkDetail': 'Ink background for low-light reading.',
  'appearance.note':
    'Your choice is saved on this device and does not follow the system setting.',

  // Privacy screen
  'privacy.title': 'Privacy',
  'privacy.body':
    'Your entries are stored privately and only used to power your daily reflections. We never share your journal content with third parties. Voice notes are not transcribed by default; transcription is only used when you explicitly enable it for Premium entry writing or a book preview.',
  'privacy.deleteAccount': 'Delete account',
  'privacy.deleteTitle': 'Delete your account?',
  'privacy.deleteMessage':
    'This permanently removes your entries, photos, and audio. This cannot be undone.',
  'privacy.deleteFailed': 'Could not delete your account. Please try again.',

  // Export
  'export.preparing': 'Preparing your export…',
  'export.failed': 'Export failed. Please try again.',
  'export.success': 'Export ready to share',
  'export.unsupported': 'Sharing is not available on this device.',
  'export.fileName': 'book-your-life-export.json',

  // Stats / progress bar
  'progress.title': 'Reflection Journey',
  'progress.streak': '{count}d streak',
  'progress.streakSingular': '1d streak',
  'progress.entriesIn30': '{count} entries in last 30 days',
  'progress.startStreak': 'Write today to start a streak',
} as const;

export type TranslationKey = keyof typeof en;
