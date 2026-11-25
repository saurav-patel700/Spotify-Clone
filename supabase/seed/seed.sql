-- SoundSphere Legal Licensed Catalog Seed (CC0 / CC BY 4.0)

INSERT INTO public.artists (id, name, slug, bio, primary_genre, artwork_url, country) VALUES
  ('art-kaito', 'Kaito Mori', 'kaito-mori', 'Tokyo based modular synthesist composing low-noise ambient structures designed for sustained concentration.', 'Ambient', 'art-kaito', 'Japan'),
  ('art-soraia', 'Soraia Lind', 'soraia-lind', 'Reykjavik pianist and sound designer blending felt-dampened keys with field resonance.', 'Minimal', 'art-soraia', 'Iceland'),
  ('art-vespera', 'Vespera Collective', 'vespera-collective', 'Berlin studio collective building precision dub techno and rhythmic nocturnal electronics.', 'Electronic', 'art-vespera', 'Germany'),
  ('art-nolan', 'Nolan Vance', 'nolan-vance', 'Tape instrumentalist crafting warm analog lo-fi textures and unhurried chord loops.', 'Lo-Fi', 'art-nolan', 'United States'),
  ('art-clara', 'Clara and The Pines', 'clara-and-the-pines', 'Acoustic ensemble recording intimate fingerstyle guitar and upright strings in Vancouver.', 'Acoustic', 'art-clara', 'Canada'),
  ('art-monolith', 'Monolith Quartet', 'monolith-quartet', 'Zurich chamber group focused on structured harmonic repetition and spatial minimalism.', 'Minimal', 'art-monolith', 'Switzerland')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.albums (id, artist_id, title, slug, cover_url, release_date, album_type, genre, featured, is_new_release) VALUES
  ('alb-quiet-telemetry', 'art-kaito', 'Quiet Telemetry', 'quiet-telemetry', 'alb-quiet-telemetry', '2026-09-14', 'album', 'Ambient', TRUE, TRUE),
  ('alb-glass-fjord', 'art-soraia', 'Glass Fjord', 'glass-fjord', 'alb-glass-fjord', '2026-06-22', 'album', 'Minimal', TRUE, FALSE),
  ('alb-subterranean-grid', 'art-vespera', 'Subterranean Grid', 'subterranean-grid', 'alb-subterranean-grid', '2026-10-30', 'album', 'Electronic', TRUE, TRUE),
  ('alb-cedar-tape', 'art-nolan', 'Cedar and Tape', 'cedar-and-tape', 'alb-cedar-tape', '2025-11-18', 'album', 'Lo-Fi', TRUE, FALSE),
  ('alb-northbound-signals', 'art-clara', 'Northbound Signals', 'northbound-signals', 'alb-northbound-signals', '2026-10-08', 'ep', 'Acoustic', FALSE, TRUE),
  ('alb-chamber-studies', 'art-monolith', 'Chamber Studies IV', 'chamber-studies-iv', 'alb-chamber-studies', '2026-08-29', 'album', 'Minimal', FALSE, TRUE),
  ('alb-night-transit', 'art-vespera', 'Night Transit', 'night-transit', 'alb-night-transit', '2026-11-04', 'single', 'Electronic', FALSE, TRUE),
  ('alb-stillwater', 'art-soraia', 'Stillwater Sketches', 'stillwater-sketches', 'alb-stillwater', '2025-04-12', 'ep', 'Ambient', FALSE, FALSE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.tracks (id, album_id, artist_id, title, track_number, duration_ms, audio_path, genre, mood, bpm, energy_level, is_instrumental, license_type, attribution_text, trending_rank) VALUES
  ('trk-01', 'alb-quiet-telemetry', 'art-kaito', 'Signal Horizon', 1, 214000, 'audio/trk-01.wav', 'Ambient', 'ambient', 72, 3, TRUE, 'CC0 1.0 Public Domain', 'SoundSphere Studio Original Session (CC0)', 1),
  ('trk-02', 'alb-quiet-telemetry', 'art-kaito', 'Thermal Drift', 2, 242000, 'audio/trk-02.wav', 'Ambient', 'ambient', 68, 2, TRUE, 'CC0 1.0 Public Domain', 'SoundSphere Studio Original Session (CC0)', NULL),
  ('trk-03', 'alb-quiet-telemetry', 'art-kaito', 'Orbital Meridian', 3, 198000, 'audio/trk-03.wav', 'Ambient', 'ambient', 76, 4, TRUE, 'CC0 1.0 Public Domain', 'SoundSphere Studio Original Session (CC0)', NULL),
  ('trk-04', 'alb-glass-fjord', 'art-soraia', 'North Shore Felt', 1, 186000, 'audio/trk-04.wav', 'Minimal', 'minimal', 80, 3, TRUE, 'CC BY 4.0', 'Soraia Lind via SoundSphere Archive (CC BY 4.0)', 3),
  ('trk-05', 'alb-glass-fjord', 'art-soraia', 'Basalt Echo', 2, 228000, 'audio/trk-05.wav', 'Minimal', 'minimal', 74, 3, TRUE, 'CC BY 4.0', 'Soraia Lind via SoundSphere Archive (CC BY 4.0)', NULL),
  ('trk-06', 'alb-glass-fjord', 'art-soraia', 'Winter Light Study', 3, 205000, 'audio/trk-06.wav', 'Minimal', 'minimal', 82, 4, TRUE, 'CC BY 4.0', 'Soraia Lind via SoundSphere Archive (CC BY 4.0)', NULL),
  ('trk-07', 'alb-subterranean-grid', 'art-vespera', 'Concrete Pulse', 1, 236000, 'audio/trk-07.wav', 'Electronic', 'electronic', 118, 7, TRUE, 'CC BY 4.0', 'Vespera Collective via SoundSphere Archive (CC BY 4.0)', 2),
  ('trk-08', 'alb-subterranean-grid', 'art-vespera', 'Station Seven', 2, 254000, 'audio/trk-08.wav', 'Electronic', 'electronic', 122, 8, TRUE, 'CC BY 4.0', 'Vespera Collective via SoundSphere Archive (CC BY 4.0)', NULL),
  ('trk-09', 'alb-subterranean-grid', 'art-vespera', 'Sublevel Four', 3, 219000, 'audio/trk-09.wav', 'Electronic', 'electronic', 116, 6, TRUE, 'CC BY 4.0', 'Vespera Collective via SoundSphere Archive (CC BY 4.0)', NULL),
  ('trk-10', 'alb-cedar-tape', 'art-nolan', 'Desk Lamp', 1, 168000, 'audio/trk-10.wav', 'Lo-Fi', 'lofi', 84, 4, TRUE, 'CC0 1.0 Public Domain', 'Nolan Vance via SoundSphere Archive (CC0)', 4),
  ('trk-11', 'alb-cedar-tape', 'art-nolan', 'Rain on Canvas', 2, 175000, 'audio/trk-11.wav', 'Lo-Fi', 'lofi', 78, 3, TRUE, 'CC0 1.0 Public Domain', 'Nolan Vance via SoundSphere Archive (CC0)', NULL),
  ('trk-12', 'alb-cedar-tape', 'art-nolan', 'Paper Margin', 3, 192000, 'audio/trk-12.wav', 'Lo-Fi', 'lofi', 86, 5, TRUE, 'CC0 1.0 Public Domain', 'Nolan Vance via SoundSphere Archive (CC0)', NULL),
  ('trk-13', 'alb-northbound-signals', 'art-clara', 'Timberline', 1, 204000, 'audio/trk-13.wav', 'Acoustic', 'acoustic', 92, 5, FALSE, 'CC BY 4.0', 'Clara and The Pines via SoundSphere Archive (CC BY 4.0)', 5),
  ('trk-14', 'alb-northbound-signals', 'art-clara', 'Harbor Fog', 2, 221000, 'audio/trk-14.wav', 'Acoustic', 'acoustic', 88, 4, FALSE, 'CC BY 4.0', 'Clara and The Pines via SoundSphere Archive (CC BY 4.0)', NULL),
  ('trk-15', 'alb-northbound-signals', 'art-clara', 'Bridge Crossing', 3, 189000, 'audio/trk-15.wav', 'Acoustic', 'acoustic', 96, 6, TRUE, 'CC BY 4.0', 'Clara and The Pines via SoundSphere Archive (CC BY 4.0)', NULL),
  ('trk-16', 'alb-chamber-studies', 'art-monolith', 'Parallel Fifths', 1, 268000, 'audio/trk-16.wav', 'Minimal', 'minimal', 72, 3, TRUE, 'CC BY 4.0', 'Monolith Quartet via SoundSphere Archive (CC BY 4.0)', 6),
  ('trk-17', 'alb-chamber-studies', 'art-monolith', 'Stone Courtyard', 2, 245000, 'audio/trk-17.wav', 'Minimal', 'minimal', 76, 4, TRUE, 'CC BY 4.0', 'Monolith Quartet via SoundSphere Archive (CC BY 4.0)', NULL),
  ('trk-18', 'alb-chamber-studies', 'art-monolith', 'Cadence Nine', 3, 230000, 'audio/trk-18.wav', 'Minimal', 'minimal', 84, 5, TRUE, 'CC BY 4.0', 'Monolith Quartet via SoundSphere Archive (CC BY 4.0)', NULL),
  ('trk-19', 'alb-night-transit', 'art-vespera', 'Night Transit', 1, 248000, 'audio/trk-19.wav', 'Electronic', 'electronic', 120, 7, TRUE, 'CC BY 4.0', 'Vespera Collective via SoundSphere Archive (CC BY 4.0)', NULL),
  ('trk-20', 'alb-stillwater', 'art-soraia', 'Stillwater I', 1, 210000, 'audio/trk-20.wav', 'Ambient', 'ambient', 66, 2, TRUE, 'CC0 1.0 Public Domain', 'Soraia Lind via SoundSphere Archive (CC0)', NULL),
  ('trk-21', 'alb-stillwater', 'art-soraia', 'Stillwater II', 2, 226000, 'audio/trk-21.wav', 'Ambient', 'ambient', 70, 2, TRUE, 'CC0 1.0 Public Domain', 'Soraia Lind via SoundSphere Archive (CC0)', NULL)
ON CONFLICT (id) DO NOTHING;
