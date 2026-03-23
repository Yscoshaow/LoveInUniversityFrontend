import { ScheduleEvent, SelfLock, CampusTask, ShopItem, UserItem, ActiveEffect, Course, Punishment } from '../types';

// --- Helpers ---
export const formatDateKey = (date: Date) => {
  return date.toISOString().split('T')[0];
};

const today = new Date();
const tomorrow = new Date(today);
tomorrow.setDate(today.getDate() + 1);

// --- Schedule Events ---
export const mockScheduleEvents: ScheduleEvent[] = [
  {
    id: '1',
    time: '08.00',
    endTime: '09.30',
    title: 'Rapat dengan Bruce Wayne',
    attendees: [
      'https://picsum.photos/id/64/100/100',
      'https://picsum.photos/id/65/100/100',
      'https://picsum.photos/id/66/100/100',
    ],
    type: 'meeting',
    date: formatDateKey(today),
    location: 'Wayne Manor, Gotham',
    description:
      'Discussing the new funding for the Wakanda outreach program and security protocols.',
  },
  {
    id: '2',
    time: '12.00',
    endTime: '13.00',
    title: 'Test wawasan kebangsaan',
    attendees: ['https://picsum.photos/id/64/100/100'],
    type: 'test',
    date: formatDateKey(today),
    location: 'Dusun Wakanda Hall B',
    description:
      'A mandatory test for all citizens regarding the history and values of the nation.',
  },
];

// --- Self Locks ---
export const mockSelfLocks: SelfLock[] = [
  {
    id: '101',
    type: 'timer',
    status: 'active',
    durationMinutes: 45,
    lockedUntil: new Date(new Date().getTime() + 45 * 60000),
    isEncrypted: true,
    imageUrl: 'https://picsum.photos/id/237/400/600',
  },
];

// --- Campus Tasks ---
export const mockCampusTasks: CampusTask[] = [
  {
    id: '1',
    title: 'Help move furniture to Dorm A',
    description:
      'Need 2 strong people to help me move a sofa and a desk to the 3rd floor. No elevator available, so be prepared for stairs!',
    rewardAmount: '$20',
    rewardType: 'money',
    status: 'ACTIVE',
    creatorName: 'Alex Johnson',
    creatorAvatar: 'https://picsum.photos/id/1005/100/100',
    coverImage: 'https://picsum.photos/id/135/600/400',
    createdAt: '2h ago',
    deadline: 'Today, 6 PM',
    submissionsCount: 1,
    tags: ['Labor', 'Urgent'],
  },
  {
    id: '2',
    title: 'Lost Cat: "Whiskers"',
    description:
      'My cat ran away near the library. Please help me find her. She is white with black spots and very shy.',
    rewardAmount: '1000 pts',
    rewardType: 'points',
    status: 'ACTIVE',
    creatorName: 'Sarah Connor',
    creatorAvatar: 'https://picsum.photos/id/1011/100/100',
    coverImage: 'https://picsum.photos/id/40/600/400',
    createdAt: '5h ago',
    submissionsCount: 8,
    tags: ['Lost & Found'],
  },
  {
    id: '3',
    title: 'Photography for Chess Club Finals',
    description:
      'Looking for a student photographer for the chess club finals this Saturday. Need about 2 hours of coverage.',
    rewardAmount: '$50',
    rewardType: 'money',
    status: 'COMPLETED',
    creatorName: 'Chess Club',
    creatorAvatar: 'https://picsum.photos/id/1025/100/100',
    createdAt: '1d ago',
    submissionsCount: 3,
    tags: ['Skill', 'Event'],
  },
  {
    id: '4',
    title: 'Calculus Tutor Needed',
    description:
      'Struggling with integrals. Need someone to explain it simply before the exam on Monday.',
    rewardAmount: '$30',
    rewardType: 'money',
    status: 'ACTIVE',
    creatorName: 'Mike Ross',
    creatorAvatar: 'https://picsum.photos/id/1001/100/100',
    createdAt: '30m ago',
    submissionsCount: 0,
    tags: ['Tutoring', 'Math'],
  },
];

export const mockMyPostedTasks: CampusTask[] = [
  {
    id: '101',
    title: 'Survey Participants Needed',
    description: 'Fill out a 5 min survey for my psych class.',
    rewardAmount: '50 pts',
    rewardType: 'points',
    status: 'ACTIVE',
    creatorName: 'Shuri',
    creatorAvatar: 'https://picsum.photos/id/338/200/200',
    createdAt: '1d ago',
    submissionsCount: 12,
    tags: ['Survey'],
  },
];

export const mockMySubmissions = [
  {
    id: 's1',
    taskTitle: 'Logo Design for Startup',
    status: 'PENDING_REVIEW',
    submittedAt: '2h ago',
    reward: '$100',
  },
  {
    id: 's2',
    taskTitle: 'Lost Keys Found',
    status: 'APPROVED',
    submittedAt: '1w ago',
    reward: '500 pts',
  },
];

export const mockTaskComments = [
  {
    id: '1',
    user: 'Jane Doe',
    avatar: 'https://picsum.photos/id/1027/50/50',
    text: 'Is this still available? I can help right now.',
    time: '10m ago',
  },
  {
    id: '2',
    user: 'Alex Johnson',
    avatar: 'https://picsum.photos/id/1005/50/50',
    text: 'Yes, please come to Dorm A entrance!',
    time: '5m ago',
  },
];

// --- Shop Items ---
export const mockShopItems: ShopItem[] = [
  {
    id: '1',
    name: 'Focus Potion',
    description: 'Increases focus timer rewards by 20% for 24 hours.',
    price: 150,
    currencyType: 'COIN',
    imageUrl: 'https://cdn-icons-png.flaticon.com/512/867/867927.png',
    category: 'CONSUMABLE',
    rarity: 'COMMON',
  },
  {
    id: '2',
    name: 'Freeze Streak',
    description: 'Prevents your daily streak from resetting if you miss a day.',
    price: 500,
    currencyType: 'COIN',
    imageUrl: 'https://cdn-icons-png.flaticon.com/512/2377/2377822.png',
    category: 'CONSUMABLE',
    rarity: 'RARE',
  },
  {
    id: '3',
    name: 'Golden Frame',
    description: 'A shiny golden frame for your avatar profile.',
    price: 50,
    currencyType: 'DIAMOND',
    imageUrl: 'https://cdn-icons-png.flaticon.com/512/3133/3133285.png',
    category: 'DECORATION',
    rarity: 'EPIC',
  },
  {
    id: '4',
    name: 'Exp Booster',
    description: 'Double XP for all tasks completed in the next 1 hour.',
    price: 300,
    currencyType: 'COIN',
    imageUrl: 'https://cdn-icons-png.flaticon.com/512/1155/1155259.png',
    category: 'CONSUMABLE',
    rarity: 'COMMON',
  },
];

export const mockInventory: UserItem[] = [
  {
    ...mockShopItems[0],
    quantity: 3,
  },
  {
    ...mockShopItems[2],
    quantity: 1,
    isEquipped: true,
  },
];

export const mockActiveEffects: ActiveEffect[] = [
  {
    id: 'e1',
    name: '2x XP Boost',
    icon: 'Zap',
    remainingTime: '45m',
    description: 'Double XP active',
  },
];

// --- Courses ---
export const mockCourses: Course[] = [
  {
    id: '101',
    title: 'Intro to Vibranium Physics',
    instructor: 'Dr. Banner',
    credits: 3,
    scheduleDay: 1,
    scheduleTime: '09:00 - 11:00',
    location: 'Lab 3A',
    description:
      'Fundamental properties of Vibranium and its applications in kinetic energy storage.',
    status: 'ENROLLED',
    capacity: 30,
    enrolledCount: 28,
    progress: 65,
    coverImage: 'https://picsum.photos/id/20/400/200',
  },
  {
    id: '102',
    title: 'Advanced Diplomacy',
    instructor: 'Queen Ramonda',
    credits: 2,
    scheduleDay: 3,
    scheduleTime: '13:00 - 15:00',
    location: 'Royal Hall',
    description: 'Strategies for international relations and resource protection.',
    status: 'AVAILABLE',
    capacity: 50,
    enrolledCount: 12,
    coverImage: 'https://picsum.photos/id/24/400/200',
  },
  {
    id: '103',
    title: 'Combat Strategy IV',
    instructor: 'General Okoye',
    credits: 4,
    scheduleDay: 5,
    scheduleTime: '06:00 - 09:00',
    location: 'Training Grounds',
    description: 'Advanced unit tactics. Requires completion of Combat Strategy III.',
    status: 'LOCKED',
    prerequisites: ['Combat Strategy III'],
    capacity: 20,
    enrolledCount: 5,
    coverImage: 'https://picsum.photos/id/73/400/200',
  },
  {
    id: '104',
    title: 'Cyber Security Basics',
    instructor: 'Shuri',
    credits: 3,
    scheduleDay: 2,
    scheduleTime: '10:00 - 12:00',
    location: 'Tech Hub',
    description: 'Protecting networks from external threats.',
    status: 'COMPLETED',
    capacity: 100,
    enrolledCount: 100,
    progress: 100,
    coverImage: 'https://picsum.photos/id/0/400/200',
  },
];

// --- Punishments ---
export const mockPunishments: Punishment[] = [
  {
    id: 'p1',
    reason: 'Late Submission: Advanced Diplomacy',
    description:
      'Failed to submit the final report by the deadline. Automatic penalty applied.',
    type: 'FINE_COIN',
    amount: 200,
    status: 'PENDING',
    issuedAt: '2024-05-18',
  },
  {
    id: 'p2',
    reason: 'Library Noise Violation',
    description:
      'Detected excessive decibels in the Silent Zone via Smart Campus Sensors.',
    type: 'XP_DEDUCTION',
    amount: 50,
    status: 'SERVED',
    issuedAt: '2024-05-10',
    resolvedAt: '2024-05-11',
  },
];

// --- User Profile ---
export const mockUser = {
  name: 'Shuri Wakanda',
  id: '2024-8839-TEC',
  major: 'Vibranium Eng.',
  level: 12,
  xp: 2450,
  nextLevelXp: 3000,
  avatar: 'https://picsum.photos/id/338/200/200',
};
