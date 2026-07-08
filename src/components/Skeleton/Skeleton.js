import React from 'react';
import styles from './Skeleton.module.css';

export const Skeleton = ({ width = '100%', height = '16px', borderRadius = '4px', className = '' }) => (
  <div
    className={`${styles.skeleton} ${className}`}
    style={{ width, height, borderRadius }}
  />
);

export const SkeletonCard = ({ lines = 3 }) => (
  <div className={styles.card}>
    <Skeleton height="20px" width="60%" />
    {Array.from({ length: lines - 1 }).map((_, i) => (
      <Skeleton key={i} height="14px" width={i % 2 === 0 ? '80%' : '50%'} />
    ))}
  </div>
);

export const SkeletonTable = ({ rows = 4, cols = 4 }) => (
  <div className={styles.table}>
    <div className={styles.tableHeader}>
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton key={i} height="14px" width="70%" />
      ))}
    </div>
    {Array.from({ length: rows }).map((_, r) => (
      <div key={r} className={styles.tableRow}>
        {Array.from({ length: cols }).map((_, c) => (
          <Skeleton key={c} height="14px" width={c === 0 ? '80%' : '60%'} />
        ))}
      </div>
    ))}
  </div>
);

export const SkeletonLawyerCard = () => (
  <div className={styles.lawyerCard}>
    <div className={styles.lawyerCardHeader}>
      <Skeleton height="22px" width="55%" />
      <Skeleton height="16px" width="80px" />
    </div>
    <Skeleton height="14px" width="45%" />
    <Skeleton height="14px" width="60%" />
    <Skeleton height="14px" width="40%" />
    <Skeleton height="38px" borderRadius="4px" />
  </div>
);

export const SkeletonDashboard = () => (
  <div className={styles.dashboard}>
    <Skeleton height="32px" width="220px" />
    <div className={styles.dashGrid}>
      {[1, 2, 3].map((i) => <SkeletonCard key={i} lines={4} />)}
    </div>
    <Skeleton height="24px" width="180px" />
    <SkeletonCard lines={5} />
  </div>
);
