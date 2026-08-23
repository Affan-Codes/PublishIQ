import { StructuredContent } from '../schemas/content-block.schema.js';
import { RenderLanguage } from '../templates/primitives.js';

export interface StressTestScenario {
  id: string;
  name: string;
  description: string;
  language: RenderLanguage;
  content: StructuredContent;
}

export const STRESS_TEST_SCENARIOS: StressTestScenario[] = [
  {
    id: 'short',
    name: 'Short Content',
    description: 'Minimal single-statement quote testing compact canvas centering',
    language: 'English',
    content: {
      blocks: [
        {
          type: 'body',
          role: 'default',
          runs: [{ text: 'Code is poetry in motion.', emphasis: 'normal' }],
        },
      ],
    },
  },
  {
    id: 'long',
    name: 'Long Content',
    description: 'Multi-line dense philosophical reflection testing vertical layout bounds',
    language: 'English',
    content: {
      blocks: [
        {
          type: 'heading',
          role: 'default',
          runs: [{ text: 'Architectural Principle', emphasis: 'primary' }],
        },
        {
          type: 'body',
          role: 'default',
          runs: [
            {
              text: 'Simplicity is prerequisite for reliability. Complex abstractions hide critical operational failure modes and create unpredictable cascading regressions under high concurrency.',
              emphasis: 'normal',
            },
          ],
        },
        {
          type: 'body',
          role: 'attribution',
          runs: [{ text: '— Edsger W. Dijkstra', emphasis: 'muted' }],
        },
      ],
    },
  },
  {
    id: 'max-blocks',
    name: 'Maximum Blocks',
    description: '6 blocks testing template maximum block capacity and gap spacing',
    language: 'English',
    content: {
      blocks: [
        { type: 'heading', role: 'default', runs: [{ text: 'Daily Dev Wisdom', emphasis: 'primary' }] },
        { type: 'body', role: 'default', runs: [{ text: 'First, solve the problem.', emphasis: 'normal' }] },
        { type: 'body', role: 'default', runs: [{ text: 'Then, write the code.', emphasis: 'secondary' }] },
        { type: 'body', role: 'default', runs: [{ text: 'Optimize only when proven necessary.', emphasis: 'normal' }] },
        { type: 'body', role: 'default', runs: [{ text: 'Keep your pipelines clean and bounded.', emphasis: 'muted' }] },
        { type: 'body', role: 'attribution', runs: [{ text: '— Software Craftsmanship', emphasis: 'muted' }] },
      ],
    },
  },
  {
    id: 'heavy-emphasis',
    name: 'Heavy Emphasis',
    description: 'High-contrast typography runs exercising primary and secondary emphasis tokens',
    language: 'English',
    content: {
      blocks: [
        {
          type: 'heading',
          role: 'default',
          runs: [
            { text: 'CRITICAL ', emphasis: 'primary' },
            { text: 'OBSERVABILITY', emphasis: 'secondary' },
          ],
        },
        {
          type: 'body',
          role: 'default',
          runs: [
            { text: 'NEVER LIE ', emphasis: 'primary' },
            { text: 'in health checks. Truthful metrics ', emphasis: 'normal' },
            { text: 'PREVENT OUTAGES.', emphasis: 'primary' },
          ],
        },
      ],
    },
  },
  {
    id: 'code-content',
    name: 'Code Content',
    description: 'Monospace command/code formatting exercising monospace layout and wrapping',
    language: 'English',
    content: {
      blocks: [
        {
          type: 'heading',
          role: 'default',
          runs: [{ text: 'Terminal Command', emphasis: 'primary' }],
        },
        {
          type: 'code',
          role: 'command',
          runs: [{ text: 'const publishiq = new Pipeline({ worker: "active" });', emphasis: 'normal' }],
        },
        {
          type: 'body',
          role: 'default',
          runs: [{ text: 'Execution completed with 0 errors.', emphasis: 'normal' }],
        },
      ],
    },
  },
  {
    id: 'hindi',
    name: 'Hindi (Devanagari)',
    description: 'Devanagari script rendering exercising Noto Sans Devanagari typography',
    language: 'Hindi',
    content: {
      blocks: [
        {
          type: 'heading',
          role: 'default',
          runs: [{ text: 'सफलता का नियम', emphasis: 'primary' }],
        },
        {
          type: 'body',
          role: 'default',
          runs: [{ text: 'धैर्य और निरंतर प्रयास ही हर कठिन लक्ष्य को आसान बना देते हैं।', emphasis: 'normal' }],
        },
        {
          type: 'body',
          role: 'attribution',
          runs: [{ text: '— भारतीय दर्शन', emphasis: 'muted' }],
        },
      ],
    },
  },
  {
    id: 'hindi-roman',
    name: 'Hindi Roman (Hinglish)',
    description: 'Romanized Hindi text exercising Latin font shaping with South Asian phrasing',
    language: 'HindiRoman',
    content: {
      blocks: [
        {
          type: 'heading',
          role: 'default',
          runs: [{ text: 'Mehnat Ka Phal', emphasis: 'primary' }],
        },
        {
          type: 'body',
          role: 'default',
          runs: [{ text: 'Koshish karne walon ki kabhi haar nahi hoti, bas sahi disha me kadam badhao.', emphasis: 'normal' }],
        },
        {
          type: 'body',
          role: 'attribution',
          runs: [{ text: '— Prernadayak Vichar', emphasis: 'muted' }],
        },
      ],
    },
  },
  {
    id: 'urdu',
    name: 'Urdu (Nastaliq)',
    description: 'Right-to-left Nastaliq script exercising Noto Nastaliq Urdu shaping',
    language: 'Urdu',
    content: {
      blocks: [
        {
          type: 'heading',
          role: 'default',
          runs: [{ text: 'حکمت کی بات', emphasis: 'primary' }],
        },
        {
          type: 'body',
          role: 'default',
          runs: [{ text: 'محنت وہ واحد راستہ ہے جو خوابوں کو حقیقت کا روپ دیتا ہے۔', emphasis: 'normal' }],
        },
        {
          type: 'body',
          role: 'attribution',
          runs: [{ text: '— اقوال زریں', emphasis: 'muted' }],
        },
      ],
    },
  },
  {
    id: 'urdu-roman',
    name: 'Urdu Roman',
    description: 'Romanized Urdu text testing Latin typography and phrasing',
    language: 'UrduRoman',
    content: {
      blocks: [
        {
          type: 'heading',
          role: 'default',
          runs: [{ text: 'Hikmat Ki Baat', emphasis: 'primary' }],
        },
        {
          type: 'body',
          role: 'default',
          runs: [{ text: 'Mehnat wo rasta hai jo khwabon ko haqeeqat ka roop deta hai.', emphasis: 'normal' }],
        },
        {
          type: 'body',
          role: 'attribution',
          runs: [{ text: '— Aqwal-e-Zareen', emphasis: 'muted' }],
        },
      ],
    },
  },
];

export default STRESS_TEST_SCENARIOS;
