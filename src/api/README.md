# API service layer

Every screen reads data through these services only. They currently resolve
from the local mock/simulation store (`src/lib/ms/store.ts`) with a small
artificial latency, so swapping in real REST endpoints (AIS, satellite,
weather, incident backend) means changing the bodies of these functions —
no UI changes required.
