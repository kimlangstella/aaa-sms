# School Management System

A comprehensive, multi-branch School Management System built with [Next.js](https://nextjs.org/). This application provides a robust administrative interface to manage students, enrollments, classes, inventory, and more across different branches.

## Key Features

- **Multi-Branch Management**: Seamlessly manage operations, programs, and inventory across multiple school branches.
- **Role-Based Access Control**: Secure access with distinct roles (`superAdmin` and `admin`) to ensure proper data visibility and restrict sensitive actions like deletions.
- **Student & Enrollment Management**: Streamline the student onboarding process, including program selection, add-ons, payment tracking, and insurance handling. Includes bulk import capabilities.
- **Program & Class Scheduling**: Flexible program setup supporting multiple pricing tiers, duration matrices, class schedules, and variants.
- **Attendance Tracking**: Intuitive interface to track, record, and clear student attendance records.
- **Inventory & Custom Product Groups**: Manage physical goods, add-ons, and customized dynamic product folders.

## Tech Stack

- Framework: [Next.js](https://nextjs.org) (App Router)
- Language: [TypeScript](https://www.typescriptlang.org/)
- Styling: [Tailwind CSS](https://tailwindcss.com/)

## Getting Started

First, install the dependencies:

```bash
npm install
# or
yarn install
# or
pnpm install
```

Then, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

