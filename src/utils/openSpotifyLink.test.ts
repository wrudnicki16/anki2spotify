const mockCanOpenURL = jest.fn();
const mockOpenURL = jest.fn();

jest.mock('react-native', () => ({
  Linking: {
    canOpenURL: mockCanOpenURL,
    openURL: mockOpenURL,
  },
}));

import { openSpotifyLink } from './openSpotifyLink';

describe('openSpotifyLink', () => {
  beforeEach(() => {
    mockCanOpenURL.mockReset();
    mockOpenURL.mockReset();
  });

  it('no-ops when both uri and url are null', async () => {
    await openSpotifyLink(null, null);
    expect(mockCanOpenURL).not.toHaveBeenCalled();
    expect(mockOpenURL).not.toHaveBeenCalled();
  });

  it('opens URI when supported', async () => {
    mockCanOpenURL.mockResolvedValue(true);
    mockOpenURL.mockResolvedValue(undefined);

    await openSpotifyLink('spotify:track:123', 'https://open.spotify.com/track/123');

    expect(mockCanOpenURL).toHaveBeenCalledWith('spotify:track:123');
    expect(mockOpenURL).toHaveBeenCalledWith('spotify:track:123');
  });

  it('falls back to URL when URI is not supported', async () => {
    mockCanOpenURL.mockResolvedValue(false);
    mockOpenURL.mockResolvedValue(undefined);

    await openSpotifyLink('spotify:track:123', 'https://open.spotify.com/track/123');

    expect(mockCanOpenURL).toHaveBeenCalledWith('spotify:track:123');
    expect(mockOpenURL).toHaveBeenCalledWith('https://open.spotify.com/track/123');
  });

  it('falls back to URL when canOpenURL throws', async () => {
    mockCanOpenURL.mockRejectedValue(new Error('fail'));
    mockOpenURL.mockResolvedValue(undefined);

    await openSpotifyLink('spotify:track:123', 'https://open.spotify.com/track/123');

    expect(mockOpenURL).toHaveBeenCalledWith('https://open.spotify.com/track/123');
  });

  it('opens URL directly when uri is null', async () => {
    mockOpenURL.mockResolvedValue(undefined);

    await openSpotifyLink(null, 'https://open.spotify.com/track/123');

    expect(mockCanOpenURL).not.toHaveBeenCalled();
    expect(mockOpenURL).toHaveBeenCalledWith('https://open.spotify.com/track/123');
  });

  it('tries URI only when url is null', async () => {
    mockCanOpenURL.mockResolvedValue(true);
    mockOpenURL.mockResolvedValue(undefined);

    await openSpotifyLink('spotify:track:123', null);

    expect(mockOpenURL).toHaveBeenCalledWith('spotify:track:123');
  });

  it('no-ops when uri is unsupported and url is null', async () => {
    mockCanOpenURL.mockResolvedValue(false);

    await openSpotifyLink('spotify:track:123', null);

    expect(mockCanOpenURL).toHaveBeenCalledWith('spotify:track:123');
    expect(mockOpenURL).not.toHaveBeenCalled();
  });
});
