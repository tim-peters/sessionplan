export const DROP_ZONE_TOP = 'drop-zone-top';
export const DROP_ZONE_BOTTOM = 'drop-zone-bottom';
export const CONTAINER_PREFIX = 'container-';
export const LANE_ID_DELIMITER = '-lane-';

export const isContainerId = (id: string | number | null | undefined): boolean =>
  typeof id === 'string' && id.startsWith(CONTAINER_PREFIX);

export const containerId = (id: string): string => `${CONTAINER_PREFIX}${id}`;

export const isDropZoneId = (
  id: string | number | null | undefined,
): id is 'drop-zone-top' | 'drop-zone-bottom' =>
  id === DROP_ZONE_TOP || id === DROP_ZONE_BOTTOM;

export const isLaneId = (id: string | number | null | undefined): boolean =>
  typeof id === 'string' && id.includes(LANE_ID_DELIMITER);

export const buildLaneId = (parentId: string, laneIndex: number): string =>
  `${parentId}${LANE_ID_DELIMITER}${laneIndex}`;

export const parseLaneId = (
  id: string,
): { parentId: string; laneIndex: number } | null => {
  const idx = id.lastIndexOf(LANE_ID_DELIMITER);
  if (idx === -1) return null;
  const parentId = id.slice(0, idx);
  const laneIndex = Number(id.slice(idx + LANE_ID_DELIMITER.length));
  if (!Number.isFinite(laneIndex)) return null;
  return { parentId, laneIndex };
};
