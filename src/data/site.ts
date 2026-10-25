/**
 * Everything on the site that isn't a round or a writing post lives here.
 * Edit text in this file; photos live in src/assets/photos/.
 */
import heroPortrait from '../assets/photos/hero-portrait.jpg';
import speakingWoodwall from '../assets/photos/speaking-woodwall.jpg';
import behindCamera from '../assets/photos/behind-camera.jpg';
import sambhavCadence from '../assets/photos/sambhav-cadence.jpg';
import mentorsBangalore from '../assets/photos/mentors-bangalore-2026.jpg';
import shubhankarUSign from '../assets/photos/shubhankar-u-sign.jpg';
import rohanGupta from '../assets/photos/rohan-gupta.jpg';
import mugAmarjeet from '../assets/photos/mug-amarjeet-2026.jpg';
import zenatixVisit from '../assets/photos/zenatix-cofounders-visit.jpg';
import zohoVembu from '../assets/photos/zoho-sridhar-vembu.jpg';
import mriirsDivyanshu from '../assets/photos/mriirs-divyanshu.jpg';
import mriirsCohort from '../assets/photos/mriirs-cohort.jpg';
import jklu from '../assets/photos/jklu-engineering-day.jpg';
import amritaSow from '../assets/photos/amrita-sow.jpg';
import amritaCir from '../assets/photos/amrita-cir-team.jpg';
import chitkara from '../assets/photos/chitkara-workshop.jpg';
import build4hire from '../assets/photos/build4hire-zoom.jpg';
import fuelEvent from '../assets/photos/fuel-event-2026.jpg';
import mentorSession from '../assets/photos/mentor-session-deepak-sood.jpg';
import roadArun from '../assets/photos/road-arun.jpg';
import roadShubhankarRishabh from '../assets/photos/road-shubhankar-rishabh.jpg';
import roadMohit from '../assets/photos/road-mohit.jpg';
import roadDeepak from '../assets/photos/road-deepak.jpg';
import roadKushal from '../assets/photos/road-kushal-shah.jpg';
import teamEarly from '../assets/photos/team-early.jpg';
import teamTownhall from '../assets/photos/team-townhall.jpg';
import teamPolos from '../assets/photos/team-polos.jpg';
import teamOffice from '../assets/photos/team-office.jpg';
import teamJul2026 from '../assets/photos/team-jul-2026.jpg';
import teamRooftop from '../assets/photos/team-2026-rooftop.jpg';
import teamLatest from '../assets/photos/team-latest.jpg';

export const person = {
  name: 'Raghav Chopra',
  role: 'Founder & CEO, UnsaidTalks Education',
  location: 'iHub Anubhuti, IIIT-Delhi, New Delhi',
  email: 'raghav@unsaidtalks.com',
  oneLiner:
    'Founder of UnsaidTalks. I help engineering students hear what nobody tells them about getting hired.',
  description:
    'Raghav Chopra is the founder and CEO of UnsaidTalks Education, which helps engineering students get industry-ready through mentorship from people who hire for a living. A Thapar ECE graduate, he worked across data, IoT engineering and business growth before going full time on UnsaidTalks in March 2025.',
  links: {
    linkedin: 'https://www.linkedin.com/in/raghav-chopra/',
    instagram: 'https://www.instagram.com/growth_with_raghav/',
    unsaidtalks: 'https://unsaidtalks.com/',
    sot: 'https://sot.unsaidtalks.com/',
    mentors: 'https://unsaidtalks.com/our-mentors',
  },
  photos: { heroPortrait, speakingWoodwall, behindCamera },
};

/** The fact table under the headline, styled like an interview-experience post. */
export const factTable = [
  { label: 'Candidate', value: 'Raghav Chopra' },
  { label: 'College', value: "Thapar, B.Tech ECE '17" },
  { label: 'Rounds', value: '11, over 13 years' },
  { label: 'Result', value: 'Founder & CEO, UnsaidTalks' },
];

/** Headline numbers. Keep them honest when updating. */
export const stats = [
  { value: '5,000+', label: 'students mentored by our team of industry mentors' },
  { value: '50+', label: 'industry mentors working across roles at top tech companies and startups' },
  { value: '1,000+', label: 'real pieces of feedback collected from students' },
  { value: '4.8/5', label: 'average session rating, across 2,000+ student ratings' },
];

/** The wide block under the numbers. */
export const company = {
  about:
    'UnsaidTalks Education Pvt. Ltd. is India’s leading mentorship platform, on a mission to bridge the gap between academics and industry. It started as a blog in 2017 and has grown into a company with a team of 12+, 50+ industry mentors and 10+ angel investors backing the vision of its founders, Raghav and Kajol.',
  advisor:
    'We build under the constant mentorship and support of our lead angel investor and key advisor, Dr. Amarjeet Singh: co-founder and CTO of Zenatix Solutions (acquired by Schneider Electric), former professor at IIIT-Delhi, IIT Delhi graduate, and M.S. and Ph.D. from UCLA.',
};

export const tips = [
  { title: 'Content is solved. Direction isn’t.', body: 'Courses, videos and roadmaps are everywhere. Ask what’s relevant to you, why it matters and how much is enough.' },
  { title: 'Ask someone who sat the same test.', body: 'The fastest way to learn is from someone a few steps ahead of you who walked the exact path recently.' },
  { title: 'Choose people over pay, early.', body: 'I took 30% less to work with the right founders. It paid back seven years later.' },
  { title: 'Choose mentors, not idols.', body: 'One person who genuinely believes in you can save you years of confusion.' },
  { title: 'Clarity comes from exposure.', body: 'Try different places. Knowing what you don’t want is progress too.' },
  { title: 'Create more than you consume.', body: 'Write, speak, build, share. One post or one conversation can change someone’s life, including yours.' },
];

/** Students who became mentors and teammates: the loop that makes UnsaidTalks work. */
export const loopStories = [
  { name: 'Naman Rastogi', from: 'The senior on stage in 2013. Now Senior Manager, Design Verification & Emulation, Sandisk', to: 'Now a mentor and an angel investor in UnsaidTalks' },
  { name: 'Smarth Singh', from: 'Mentored by Shubhankar Sharma (Full Stack Developer, BlackRock). Placed as a Software Engineer at Incedo in 2025', to: 'Now mentors UnsaidTalks students himself' },
  { name: 'Bhoomi Gupta', from: 'Learned with UnsaidTalks as a student', to: 'Now a full-stack engineer on our team' },
  { name: 'Jatin', from: 'Joined UnsaidTalks in his first year of college', to: 'Still pitching in, two years after graduating' },
];

export const sambhav = {
  photo: sambhavCadence,
  alt: 'Raghav with Sambhav, a UMP Ultimate student placed at Cadence',
  quote: 'The team is really accountable and supportive, also their focused material really helped me in cracking interviews.',
  name: 'Sambhav Mehta',
  context: 'UMP Ultimate student, mentored by Rishabh Kaistha (Staff Engineer, STMicroelectronics), placed at Cadence',
};

export const testimonials = [
  {
    quote:
      'I only started actively contacting founders and cold mailing startups after getting inspired from Madhur sir’s lecture, and now I’m working at one.',
    name: 'Kshitij Thareja',
    context: 'UnsaidTalks Mentorship Program, inspired by mentor Madhur Yadav (Data Science Consultant, Saiva)',
    source: 'Google review',
  },
  {
    quote:
      'What I appreciated most was that it never felt transactional. There was a genuine personal touch in how they guided and mentored me.',
    name: 'Shubham Yadav',
    context: 'UnsaidTalks student',
    source: 'Google review',
  },
  {
    quote:
      'This journey made me realize that real growth happens outside comfort zones. As I got placed as a Java Developer, I feel thankful, emotional, and motivated for the journey ahead.',
    name: 'Shruti Agrawal',
    context: 'Mentored by Shubhankar Sharma (Full Stack Developer, BlackRock) and Anurag Khokhar (SDE, Josh Technology Group)',
    source: 'Google review',
  },
  {
    quote:
      'The sessions helped me understand where I need to improve, identify my skill gaps, and learn how to work on them effectively.',
    name: 'Pranav',
    context: 'Amrita Vishwa Vidyapeetham cohort',
    source: 'Google review',
  },
];

export const workingWithMe = {
  quote:
    'I learned a lot during my time here, especially from Raghav & Kajol. It really pushed me to grow both technically and professionally.',
  name: 'Vansh Malkoti',
  context: 'Former intern, UnsaidTalks',
};

export const programs = [
  {
    name: 'UnsaidTalks Mentorship Program',
    short: 'UMP',
    body: 'Live, structured placement preparation with mentors from top companies: career clarity, projects, resumes, DSA, system design and mock interviews. Software and electronics tracks, for students and for colleges.',
    href: 'https://unsaidtalks.com/',
  },
  {
    name: 'Build4Hire',
    short: '9 months',
    body: 'An execution-first program where students build real software, the way teams build it now, with industry mentors reviewing the work.',
    href: 'https://unsaidtalks.com/',
  },
  {
    name: 'School of Technology F.U.E.L.',
    short: 'Offline',
    body: 'Focus, Upskill, Earn, Learn. Students pursuing the IIT Madras BS degree online learn from our office at iHub Anubhuti, IIIT-Delhi, alongside our tech team. An independent UnsaidTalks program.',
    href: 'https://sot.unsaidtalks.com/',
  },
  {
    name: 'AI Summer Training',
    short: '2 weeks',
    body: 'A hands-on introduction to building with AI for engineering students, run on campus with our mentors.',
    href: 'https://unsaidtalks.com/',
  },
];

/** "What we are building": the three focus areas, in order. Bodies may contain <strong>. */
export const focusAreas = [
  {
    number: '01',
    name: 'UnsaidTalks Mentorship Program',
    kind: 'UMP',
    href: 'https://unsaidtalks.com/',
    linkLabel: 'unsaidtalks.com',
    tracks: [
      { label: 'B2B · Colleges', body: 'Group mentorship for colleges and universities, delivered to whole student cohorts.' },
      { label: 'B2C · Students', body: 'A recorded program, or <strong>UMP Ultimate</strong>: highly personalised mentorship.' },
    ],
  },
  {
    number: '02',
    name: 'SoT F.U.E.L. Program',
    kind: 'School of Technology',
    href: 'https://sot.unsaidtalks.com/',
    linkLabel: 'sot.unsaidtalks.com',
    body: 'An offline centre for students pursuing the <strong>IIT Madras online BS degree</strong>, at iHub Anubhuti, IIIT-Delhi.',
  },
  {
    number: '03',
    name: 'Tech Projects',
    kind: 'IT services',
    body: 'Client projects delivered by our tech team, giving <strong>SoT F.U.E.L. students real work</strong> to build on.',
  },
];

export const colleges = [
  { name: 'Amrita Vishwa Vidyapeetham', detail: 'UMP for 4,000+ students across 7 campuses', photo: amritaSow, alt: 'Signing the statement of work with the Director of Corporate & Industry Relations, Amrita Vishwa Vidyapeetham' },
  { name: 'Manav Rachna (MRIIRS)', detail: 'Our first college cohort (Oct 2024), then an MoU (Jan 2025)', photo: mriirsCohort, alt: 'MRIIRS students with Dr. Tapas Kumar and Ms. Meghna' },
  { name: 'Thapar Institute (ECE)', detail: 'My alma mater. MoU signed in 2018, when we were still a blog', photo: null, alt: '' },
  { name: 'Chitkara University', detail: 'Three-day workshop with students', photo: chitkara, alt: 'Chitkara students doing the U sign after a three-day workshop' },
  { name: 'JK Lakshmipat University', detail: 'Guests for Engineering Day', photo: jklu, alt: 'Raghav, Kajol and Shubhankar with Dr. Tapas Kumar at JKLU' },
];

export const collegePhotos = [
  { photo: mriirsDivyanshu, alt: 'Raghav with Dr. Divyanshu Sinha at the UnsaidTalks office', caption: 'Dr. Divyanshu Sinha visiting our office.' },
  { photo: amritaCir, alt: 'Raghav with the Corporate & Industry Relations team at Amrita Vishwa Vidyapeetham, Amritapuri', caption: 'With the CIR team at Amrita, Amritapuri.' },
];

export const mentorCompanies = [
  'NVIDIA', 'Google', 'Apple', 'Amazon', 'Oracle', 'BlackRock', 'JPMorgan Chase', 'Atlassian',
  'Sandisk', 'Synopsys', 'STMicroelectronics', 'NXP', 'Sony', 'ServiceNow', 'PhonePe', 'Paytm',
  'Juspay', 'KPMG', 'Wells Fargo', 'AT&T', 'IIT faculty',
];

export const mentorPhotos = {
  bangalore: { photo: mentorsBangalore, alt: 'UnsaidTalks mentors in Bangalore doing the U sign together', caption: 'Our Bangalore mentors, March 2026. Kajol and I hosted them to say thank you in person.' },
  shubhankar: { photo: shubhankarUSign, alt: 'Raghav and Shubhankar Sharma doing the U sign', caption: 'Shubhankar Sharma (Full Stack Developer, BlackRock), my school friend, runs our cohorts with Kajol and me.' },
  session: { photo: mentorSession, alt: 'Mentor Deepak Sood presenting Data Structures for Interviews', caption: 'Deepak Sood (Senior AI, Data & DevOps Architect, Opstree) on data structures for interviews.' },
};

export const road = [
  { photo: roadArun, alt: 'Raghav with mentor Arun Rajesh in a car', name: 'Arun Rajesh, product leader, qikfox cybersecurity' },
  { photo: roadShubhankarRishabh, alt: 'Raghav with mentors Shubhankar Sharma and Rishabh Kaistha in a car', name: 'Shubhankar Sharma (BlackRock) & Rishabh Kaistha (STMicroelectronics)' },
  { photo: roadMohit, alt: 'Raghav with mentor Mohit Kumar in a car', name: 'Mohit Kumar, Senior Staff Engineer, NXP' },
  { photo: roadDeepak, alt: 'Raghav with mentor Deepak Sood in a car', name: 'Deepak Sood, Senior AI, Data & DevOps Architect, Opstree' },
  { photo: roadKushal, alt: 'Raghav with Dr. Kushal Shah in a car', name: 'Dr. Kushal Shah, former IIT Delhi professor' },
];

export const backers = {
  lead: { photo: mugAmarjeet, alt: 'Raghav handing Dr. Amarjeet Singh an UnsaidTalks mug', caption: 'Still meeting, still learning. Dr. Amarjeet Singh, 2026.' },
  rohan: { photo: rohanGupta, alt: 'Raghav with Rohan Gupta at sunset', caption: 'Rohan Gupta (Senior Design Engineer, NVIDIA): college friend, mentor and angel.' },
  zenatix: { photo: zenatixVisit, alt: 'Raghav and Kajol with Dr. Amarjeet Singh and Vishal, co-founders of Zenatix', caption: 'Both Zenatix co-founders, Dr. Amarjeet and Vishal, came to teach our team.' },
  zoho: { photo: zohoVembu, alt: 'Raghav and Kajol with Sridhar Vembu at Zoho', caption: 'Learning how Zoho trains freshers, with Sridhar Vembu.' },
  names: 'Dr. Amarjeet Singh (lead), Rohan Gupta (Senior Design Engineer, NVIDIA), Akshit Arora (Senior Data Scientist, NVIDIA), Naman Rastogi (Senior Manager, Sandisk), Pratibha Ola (GPU Physical Design Engineer, Apple), Shubhankar Sharma (Full Stack Developer, BlackRock), Tarundeep Singh (A&MS Design Engineer, Synopsys), Japnit Kaur Sidhu (Associate Program Manager, Juspay), Gifty Mehra (HR Partner, InfoEdge) and others',
};

export const fuelEventPhoto = { photo: fuelEvent, alt: 'IIT Madras BS students at UnsaidTalks’ first offline event at IIIT-Delhi', caption: 'Our first offline event, for IIT Madras BS students, at IIIT-Delhi.' };
export const build4hirePhoto = { photo: build4hire, alt: 'Build4Hire students on a video call doing the U sign', caption: 'Build4Hire students, signing off with the U.' };

/** The team, oldest to newest. */
export const teamTimeline = [
  { photo: teamEarly, alt: 'An early UnsaidTalks team photo', caption: 'The early days' },
  { photo: teamTownhall, alt: 'One of the first UnsaidTalks townhalls', caption: 'One of our first townhalls' },
  { photo: teamPolos, alt: 'The UnsaidTalks team in black polos doing the U sign', caption: 'Growing' },
  { photo: teamOffice, alt: 'The UnsaidTalks team in the office doing the U sign', caption: 'More of us' },
  { photo: teamJul2026, alt: 'The UnsaidTalks team at a whiteboard, July 2026', caption: 'July 2026' },
  { photo: teamRooftop, alt: 'The UnsaidTalks team on a rooftop, 2026', caption: 'Celebrating 2026' },
  { photo: teamLatest, alt: 'The current UnsaidTalks team', caption: 'Today' },
];
