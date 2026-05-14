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

  // Onboarding
  'onboarding.step': 'Step {current} of {total}',
  'onboarding.profile.title': "Let's set you up",
  'onboarding.profile.subtitle':
    'Your face photo helps us draw illustrations that look like you in your book chapters.',
  'onboarding.profile.addPhoto': '+ Add face photo',
  'onboarding.profile.namePlaceholder': 'Your name',
  'onboarding.gender.title': 'How do you identify?',
  'onboarding.gender.subtitle':
    'Helps us tailor reflections. You can change this later.',
  'onboarding.gender.male': 'Male',
  'onboarding.gender.female': 'Female',
  'onboarding.gender.non_binary': 'Non-binary',
  'onboarding.gender.prefer_not_to_say': 'Prefer not to say',
  'onboarding.birthday.title': 'When were you born?',
  'onboarding.birthday.subtitle':
    'We use your age to make reflections feel more like you.',
  'onboarding.birthday.year': 'Year',
  'onboarding.birthday.month': 'Month',
  'onboarding.birthday.day': 'Day',
  'onboarding.goal.title': 'What brings you here?',
  'onboarding.goal.subtitle': 'Pick what fits best.',
  'onboarding.goal.self_reflection': 'Self-reflection',
  'onboarding.goal.mental_health': 'Mental health',
  'onboarding.goal.memory': 'Memory keeping',
  'onboarding.goal.creativity': 'Creativity',
  'onboarding.goal.other': 'Other',
  'onboarding.language.title': 'Choose your language',
  'onboarding.language.subtitle':
    'You can change this anytime in More → Language.',
  'onboarding.error.required': 'Please pick an option to continue.',
  'onboarding.error.save': 'Failed to save profile',

  // Profile screen
  'profile.title': 'Profile',
  'profile.displayName': 'Display name',
  'profile.gender': 'Gender',
  'profile.birthday': 'Birthday',
  'profile.goal': 'Why you journal',
  'profile.facePhoto': 'Face photo',
  'profile.changePhoto': 'Change photo',
  'profile.saved': 'Saved',

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
    'Your entries are stored privately and only used to power your daily reflections. We never share your journal content with third parties. Voice notes are not transcribed by default; transcription is only used when you explicitly enable it for a book preview.',
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
