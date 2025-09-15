interface LatLngExpression {
  lat: number;
  lng: number;
}

const createPolygonFromPoints = (
  points: LatLngExpression[]
): LatLngExpression[] => {
  if (points.length < 2) return points;

  // Create a buffer around the points
  const bufferDistance = 0.02; // About 2km buffer
  const bufferedPoints: LatLngExpression[] = [];

  // For each point, create a circle of points around it
  points.forEach(({ lat, lng }) => {
    // Create 8 points around each original point
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
      bufferedPoints.push({
        lat: lat + bufferDistance * Math.cos(angle),
        lng: lng + bufferDistance * Math.sin(angle),
      });
    }
  });

  // Add original points
  bufferedPoints.push(...points);

  // Create a convex hull from all points
  return createConvexHull(bufferedPoints);
};

const createConvexHull = (points: LatLngExpression[]): LatLngExpression[] => {
  if (points.length < 3) return points;

  // Find point with lowest latitude (and leftmost if tied)
  let bottomPoint = points[0];
  points.forEach((point) => {
    if (
      point.lat < bottomPoint.lat ||
      (point.lat === bottomPoint.lat && point.lng < bottomPoint.lng)
    ) {
      bottomPoint = point;
    }
  });

  // Sort points by polar angle with respect to base point
  const sortedPoints = points
    .filter((p) => p !== bottomPoint)
    .sort((a, b) => {
      const angleA = Math.atan2(
        a.lat - bottomPoint.lat,
        a.lng - bottomPoint.lng
      );
      const angleB = Math.atan2(
        b.lat - bottomPoint.lat,
        b.lng - bottomPoint.lng
      );
      return angleA - angleB;
    });

  // Build convex hull
  const hull = [bottomPoint];
  sortedPoints.forEach((point) => {
    while (
      hull.length >= 2 &&
      !isLeftTurn(hull[hull.length - 2], hull[hull.length - 1], point)
    ) {
      hull.pop();
    }
    hull.push(point);
  });

  return hull;
};

const isLeftTurn = (
  p1: LatLngExpression,
  p2: LatLngExpression,
  p3: LatLngExpression
): boolean => {
  return (
    (p2.lng - p1.lng) * (p3.lat - p1.lat) -
      (p3.lng - p1.lng) * (p2.lat - p1.lat) >
    0
  );
};

const getZoneCenter = (coordinates: LatLngExpression[]) => {
  if (!coordinates || coordinates.length === 0) return [0, 0];

  const lats = coordinates.map((coord) => coord.lat);
  const lngs = coordinates.map((coord) => coord.lng);

  const centerLat = (Math.max(...lats) + Math.min(...lats)) / 2;
  const centerLng = (Math.max(...lngs) + Math.min(...lngs)) / 2;

  return [centerLat, centerLng];
};

// Zone styling options
const getZoneOptions = () => ({
  color: "#fac142",
  fillColor: "#fac142",
  fillOpacity: 0.2,
  weight: 2,
});

const extractNumbers = (postalCode: string) => {
  return postalCode.replace(/[^0-9]/g, "");
};

export {
  createPolygonFromPoints,
  getZoneOptions,
  extractNumbers,
  getZoneCenter,
};
