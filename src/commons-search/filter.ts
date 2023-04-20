import haversine from 'haversine-distance';
import { computed, Ref } from 'vue';
import { isDateInDayRange, toDateString, useMap } from '../util';
import {
  Common,
  CommonAvailabilityStatus,
  CommonLocation,
  CommonsSearchAPI,
  GeoCoordinate,
} from './types';
import { GeoLocation } from './geo';

const AVAILABLE_STATES: CommonAvailabilityStatus[] = ['available'];

export interface CommonFilterSet {
  categories: Set<number>;
  userLocation: GeoLocation | null;
  location: CommonLocation | null;
  mapCenter: GeoCoordinate | null;
  availableToday: boolean;
  availableBetween: { start: Date | null; end: Date | null };
}

type FilterFunction<T> = (obj: T, index?: number, iterable?: T[]) => boolean;

function filterIterable<T>(iterable: T[], filters: (FilterFunction<T> | unknown)[]): T[] {
  const _filters = filters.filter((f) => typeof f === 'function') as FilterFunction<T>[];
  return _filters.length > 0
    ? iterable.filter((obj, index, iterable) => {
        for (const shouldKeep of _filters) {
          if (!shouldKeep(obj, index, iterable)) return false;
        }
        return true;
      })
    : iterable;
}

function filterByCategories(relevantCategoryIds: Set<number>) {
  return (common: Common) =>
    Array.from(relevantCategoryIds).every((id) => common.categoryIds.includes(id));
}

function filterByRelevantLocations(relevantLocationIds: Set<string>) {
  return (location: CommonLocation) => relevantLocationIds.has(location.id);
}

function filterByLocation(location: CommonLocation) {
  return (common: Common) => common.locationId === location.id;
}

function filterByDateAvailability(date: Date, validStates: CommonAvailabilityStatus[]) {
  const dateString = toDateString(date);
  return (common: Common) => {
    const dayAvailability = common.availabilities.find((a) => toDateString(a.date) === dateString);
    return !!dayAvailability && validStates.includes(dayAvailability.status);
  };
}

function filterByAvailabilityRange(
  start: Date,
  end: Date,
  validStates: CommonAvailabilityStatus[],
) {
  return (common: Common) => {
    const relevantAvailabilities = common.availabilities.filter((a) =>
      isDateInDayRange(start, end, a.date, true),
    );
    return relevantAvailabilities.every(({ status }) => validStates.includes(status));
  };
}

function sortByDistance(location: GeoCoordinate, locationMap: Map<string, CommonLocation>) {
  return function (a: Common, b: Common) {
    const locationA = locationMap.get(a.locationId)?.coordinates;
    const locationB = locationMap.get(b.locationId)?.coordinates;
    if (!locationA || !locationB) return 0;
    const distanceA = haversine(location, locationA);
    const distanceB = haversine(location, locationB);
    return distanceB < distanceA ? 1 : -1;
  };
}

export function useFilteredData(
  api: Ref<CommonsSearchAPI | undefined>,
  filter: Ref<CommonFilterSet>,
) {
  const locations = computed(() => api.value?.locations ?? []);
  const locationMap = useMap(locations, 'id');

  const filteredCommons = computed(() => {
    const commons = api.value?.commons ?? [];
    const today = filter.value.availableToday ? new Date() : null;
    const { start, end } = filter.value.availableBetween;
    const filteredCommons = filterIterable(commons, [
      today && filterByDateAvailability(today, AVAILABLE_STATES),
      start && end === null && filterByDateAvailability(start, AVAILABLE_STATES),
      start && end && filterByAvailabilityRange(start, end, AVAILABLE_STATES),
      filter.value.categories.size > 0 && filterByCategories(filter.value.categories),
      filter.value.location && filterByLocation(filter.value.location),
    ]);

    if (filter.value.userLocation) {
      filteredCommons.sort(sortByDistance(filter.value.userLocation, locationMap.value));
    } else if (filter.value.mapCenter) {
      filteredCommons.sort(sortByDistance(filter.value.mapCenter, locationMap.value));
    }

    return filteredCommons;
  });

  const relevantLocationIds = computed(
    () => new Set(filteredCommons.value.map((common) => common.locationId)),
  );
  const filteredLocations = computed(() => {
    return locations.value.filter(filterByRelevantLocations(relevantLocationIds.value));
  });

  return { filteredLocations, filteredCommons };
}
