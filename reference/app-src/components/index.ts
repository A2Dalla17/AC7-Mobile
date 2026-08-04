/**
 * AC7 Ride — component barrel
 *
 * Screens import from `@/components`, not from individual files. That keeps
 * import blocks short and, more usefully, makes it obvious when a screen is
 * hand-rolling something the system already provides — if a screen is building
 * its own trip row, it will not appear in this import list.
 *
 *   ui/      generic primitives. Know nothing about ride-hailing.
 *   domain/  ride-hailing components. Know about rides, drivers, fares.
 *   map/     Leaflet wrappers.
 *   charts/  data visualisation.
 */

/* ---- Primitives --------------------------------------------------------- */
export { Avatar } from './ui/Avatar';
export { AvatarUpload } from './ui/AvatarUpload';
export { Badge, CountBadge, RideStatusBadge } from './ui/Badge';
export { Button, Fab, IconButton } from './ui/Button';
export { Card, CardHeader, ListRow } from './ui/Card';
export { DataTable } from './ui/DataTable';
export {
  EmptyState,
  ErrorState,
  OfflineBanner,
  OfflineState,
  SuccessState,
  useOnlineStatus,
} from './ui/EmptyState';
export {
  ErrorArt,
  NoNotificationsArt,
  NoPlacesArt,
  NoResultsArt,
  NoTripsArt,
  NoWalletArt,
  OfflineArt,
  SuccessArt,
} from './ui/Illustration';
export { Input, SearchBar, Textarea } from './ui/Input';
export { Modal } from './ui/Modal';
export { PageHeader, ScreenHeader, SectionHeader } from './ui/PageHeader';
export { RatingInput, RatingStars } from './ui/Rating';
export { RouteRail } from './ui/RouteRail';
export { FilterChips, SegmentedControl, type Segment } from './ui/SegmentedControl';
export { Sheet, useFocusTrap } from './ui/Sheet';
export { Skeleton, SkeletonList } from './ui/Skeleton';
export { Spinner, FullPageSpinner } from './ui/Spinner';
export { StatCard } from './ui/StatCard';
export { ToastProvider, useToast } from './ui/Toast';

/* ---- Domain ------------------------------------------------------------- */
export { BalanceCard, BalanceCaption, StatStrip } from './domain/BalanceCard';
export { DriverCard } from './domain/DriverCard';
export { CouponCard, PromoBanner } from './domain/OfferCard';
export { PaymentMethodRow } from './domain/PaymentMethodRow';
export { TripCard } from './domain/TripCard';
export { VehicleOption } from './domain/VehicleOption';

/* ---- Map ---------------------------------------------------------------- */
export { MapView } from './map/MapView';
export type { MapViewProps } from './map/types';
export { NavigateButton } from './map/NavigateButton';
