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
