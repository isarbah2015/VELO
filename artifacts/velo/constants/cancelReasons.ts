// Cancelling a ride is always free — VELO never charges a cancellation fee,
// for riders or drivers, at any stage. A reason is required on both sides so
// disputes and driver/rider reliability can be reviewed later.
export const RIDER_CANCEL_REASONS = [
  'Driver is taking too long',
  'Wrong pickup location',
  'Found another ride',
  'Price too high',
  'Changed my mind',
  'Booked by mistake',
  'Other',
] as const;

export const DRIVER_CANCEL_REASONS = [
  'Rider not at pickup location',
  'Rider requested cancellation',
  'Unsafe or unclear pickup location',
  'Vehicle issue',
  'Wrong trip details',
  'Other',
] as const;
