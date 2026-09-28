import type { Profile } from '../profile';

export const PROFILE_REPOSITORY = Symbol('PROFILE_REPOSITORY');

export interface ProfileRepository {
  findPublicProfile(): Promise<Profile | null>;
  save(profile: Profile): Promise<void>;
}
