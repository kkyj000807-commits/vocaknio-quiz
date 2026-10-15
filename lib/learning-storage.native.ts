// Metro platform resolution keeps native window polyfills out of the web DB.
import { createLearningStorageAdapter } from "./learning-storage-core";
export * from "./learning-storage-core";
export default createLearningStorageAdapter(undefined, () => null);
