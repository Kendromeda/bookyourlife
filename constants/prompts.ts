import type { LanguageCode } from '@/utils/users';

export type PromptPack = {
  id: string;
  title: string;
  icon: string;
  description: string;
  prompts: string[];
};

export const PROMPT_PACKS: PromptPack[] = [
  {
    id: 'reflection',
    title: 'Reflection',
    icon: 'sparkles',
    description: 'Pause and look inward — what surfaced today?',
    prompts: [
      'What can I forgive myself for?',
      'What did I learn about myself this week?',
      'When did I feel most like myself recently?',
      'What is something I keep avoiding, and why?',
      'What belief do I hold that may no longer serve me?',
      'What would my younger self think of me now?',
      'What pattern am I noticing in how I react to stress?',
    ],
  },
  {
    id: 'gratitude',
    title: 'Gratitude',
    icon: 'sparkles',
    description: 'Notice the small good things.',
    prompts: [
      'What am I grateful for today?',
      'Who in my life am I most thankful for and why?',
      'What is one small moment that brought me joy this week?',
      'What about my body am I thankful for?',
      'Which simple comfort do I take for granted?',
    ],
  },
  {
    id: 'about-me',
    title: 'About Me',
    icon: 'person.fill',
    description: 'Build a portrait of who you are right now.',
    prompts: [
      'How would my closest friend describe me?',
      'What three values guide most of my decisions?',
      'What do I do for fun when no one is watching?',
      'What is something I do well that I rarely acknowledge?',
      'What role does my family play in who I am today?',
    ],
  },
  {
    id: 'mindfulness',
    title: 'Mindfulness',
    icon: 'sparkles',
    description: 'Drop into the present moment.',
    prompts: [
      'If I engage with my senses right now, what am I noticing?',
      'What is my body telling me?',
      'Where in my day did I lose presence?',
      'What thought keeps returning, and what is it asking for?',
    ],
  },
  {
    id: 'creativity',
    title: 'Creativity',
    icon: 'wand.and.stars',
    description: 'Stretch your imagination with playful prompts.',
    prompts: [
      'In what ways am I creative?',
      'How do I incorporate creativity into my daily life?',
      'Where do I find inspiration?',
      'Who are the creative people I admire?',
      "What's my favorite creative medium?",
      'What creative skills do I want to develop?',
      "What I'd put in a time capsule to confuse future archaeologists",
    ],
  },
];

export const RECOMMENDED: { text: string; pack: string }[] = [
  { text: 'What can I forgive myself for?', pack: 'Reflection' },
  { text: 'If I engage with my senses right now, what am I noticing?', pack: 'Mindfulness' },
  { text: 'Who in my life am I most thankful for and why?', pack: 'Gratitude' },
];

const PROMPT_PACKS_ID: PromptPack[] = [
  {
    id: 'reflection',
    title: 'Refleksi',
    icon: 'sparkles',
    description: 'Berhenti sebentar dan lihat ke dalam diri.',
    prompts: [
      'Apa yang bisa saya maafkan dari diri saya?',
      'Apa yang saya pelajari tentang diri saya minggu ini?',
      'Kapan saya merasa paling menjadi diri sendiri akhir-akhir ini?',
      'Apa yang terus saya hindari, dan kenapa?',
      'Keyakinan apa yang mungkin sudah tidak membantu saya?',
      'Apa yang akan dipikirkan versi kecil saya tentang saya sekarang?',
      'Pola apa yang saya lihat saat saya merespons stres?',
    ],
  },
  {
    id: 'gratitude',
    title: 'Rasa Syukur',
    icon: 'sparkles',
    description: 'Perhatikan hal-hal kecil yang baik.',
    prompts: [
      'Apa yang saya syukuri hari ini?',
      'Siapa yang paling saya syukuri dalam hidup saya, dan kenapa?',
      'Momen kecil apa yang membuat saya senang minggu ini?',
      'Apa dari tubuh saya yang saya syukuri?',
      'Kenyamanan sederhana apa yang sering saya anggap biasa?',
    ],
  },
  {
    id: 'about-me',
    title: 'Tentang Saya',
    icon: 'person.fill',
    description: 'Bangun potret tentang siapa saya saat ini.',
    prompts: [
      'Bagaimana sahabat terdekat saya akan menggambarkan saya?',
      'Tiga nilai apa yang paling memandu keputusan saya?',
      'Apa yang saya lakukan untuk bersenang-senang saat tidak ada yang melihat?',
      'Apa hal yang saya lakukan dengan baik tapi jarang saya akui?',
      'Peran apa yang keluarga saya punya dalam membentuk saya hari ini?',
    ],
  },
  {
    id: 'mindfulness',
    title: 'Kesadaran Diri',
    icon: 'sparkles',
    description: 'Masuk ke momen saat ini.',
    prompts: [
      'Jika saya memperhatikan indra saya sekarang, apa yang saya sadari?',
      'Apa yang sedang tubuh saya sampaikan?',
      'Di bagian mana hari ini saya kehilangan kehadiran?',
      'Pikiran apa yang terus kembali, dan apa yang ia minta?',
    ],
  },
  {
    id: 'creativity',
    title: 'Kreativitas',
    icon: 'wand.and.stars',
    description: 'Regangkan imajinasi dengan pertanyaan ringan.',
    prompts: [
      'Dalam hal apa saya kreatif?',
      'Bagaimana saya memasukkan kreativitas ke kehidupan sehari-hari?',
      'Di mana saya menemukan inspirasi?',
      'Siapa orang kreatif yang saya kagumi?',
      'Medium kreatif apa yang paling saya sukai?',
      'Skill kreatif apa yang ingin saya kembangkan?',
      'Apa yang akan saya masukkan ke kapsul waktu untuk masa depan?',
    ],
  },
];

const RECOMMENDED_ID: { text: string; pack: string }[] = [
  { text: 'Apa yang bisa saya maafkan dari diri saya?', pack: 'Refleksi' },
  { text: 'Jika saya memperhatikan indra saya sekarang, apa yang saya sadari?', pack: 'Kesadaran Diri' },
  { text: 'Siapa yang paling saya syukuri dalam hidup saya, dan kenapa?', pack: 'Rasa Syukur' },
];

export function getPromptPacks(language: LanguageCode | undefined): PromptPack[] {
  return language === 'id' ? PROMPT_PACKS_ID : PROMPT_PACKS;
}

export function getRecommended(language: LanguageCode | undefined): { text: string; pack: string }[] {
  return language === 'id' ? RECOMMENDED_ID : RECOMMENDED;
}
