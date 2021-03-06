interface Tags {
  [key: string]: string
}

export interface MediaStream {
  index: number
  codec_name: string
  codec_long_name: string
  codec_type: 'video' | 'audio' | 'subtitle'
  start_time: string
  disposition: {
    'default': boolean
    forced:  boolean
  }
  tags?: Tags
}

export interface VideoStream extends MediaStream {
  width: number
  height: number
  pix_fmt: string
  coded_width: number
  coded_height: number
  sample_aspect_ratio: 'string'
  display_aspect_ratio: 'string'
  bits_per_raw_sample?: '8' | '10'
}

export interface AudioStream extends MediaStream {
  channels: number
  channel_layout: string
  bit_rate?: string
  bits_per_sample?: string
  sample_rate: string
}

export interface MediaChapter {
  id: number
  start_time: string
  end_time: string
  tags: {
    title: string
  }
}

export interface MediaFormat {
  filename: string
  format_name: string
  format_long_name: string
  duration: string
  size: string
  tags: Tags
}

type CombinedMediaStream = MediaStream & VideoStream & AudioStream;

export interface Media {
  streams: CombinedMediaStream[],
  chapters: MediaChapter[],
  format: MediaFormat
}

/**
 * Returns milliseconds, 1/1000 of second
 *
 * @param {string} time
 * @returns {number}
 */
export function parseTime(time: string): number {
  return parseFloat(time) * 1000;
}

/**
 * Parses video stream
 *
 * @param video
 * @returns {Bakaru.ParsedVideo}
 */
export function parseVideoStream(video: VideoStream): Bakaru.ParsedVideo {
  const parsed: Bakaru.ParsedVideo = {
    codec: video.codec_name.toString().trim(),
    width: video.width,
    height: video.height,
    startTime: video.start_time ? parseTime(video.start_time) : 0.0,
    bitsPerPixel: '8'
  };

  if (video.bits_per_raw_sample) {
    parsed.bitsPerPixel = video.bits_per_raw_sample;
  }

  return parsed;
}

/**
 * Parses audio stream
 *
 * @param {AudioStream} audio
 * @returns {Bakaru.ParsedAudio}
 */
export function parseAudioStream(audio: AudioStream): Bakaru.ParsedAudio {
  let bitRate: number;

  switch (true) {
    case !!audio.bit_rate:
      bitRate = parseInt(audio.bit_rate, 10);
      break;

    case !!audio.bits_per_sample:
      bitRate = parseInt(audio.bits_per_sample, 10);
      break;

    default:
      bitRate = -1;
      break;
  }

  return <Bakaru.ParsedAudio>{
    bitRate,
    codec: audio.codec_name,
    channels: audio.channels,
    'default': !!audio.disposition.default,
    forced: !!audio.disposition.forced
  };
}

/**
 * Parses subtitle stream
 *
 * @param {MediaStream} subtitle
 * @returns {Bakaru.ParsedSubtitle}
 */
export function parseSubtitleStream(subtitle: MediaStream): Bakaru.ParsedSubtitle {
  let language = '';

  if (subtitle.tags && subtitle.tags['language']) {
    language = subtitle.tags['language'].toString().trim();
  }

  return <Bakaru.ParsedSubtitle>{
    language,
    'default': !!subtitle.disposition.default,
    forced: !!subtitle.disposition.forced
  };
}

/**
 * Parses streams output
 *
 * @param {CombinedMediaStream[]} streams
 * @returns {Bakaru.ParsedStreams}
 */
export function parseStreams(streams: CombinedMediaStream[]): Bakaru.ParsedStreams {
  const parsed: Bakaru.ParsedStreams = {
    video: null,
    audios: [],
    subtitles: []
  };

  for (let i = 0, len = streams.length; i < len; i++) {
    const stream = streams[i];

    switch (stream.codec_type) {
      case 'video':
        if (parsed.video === null) {
          parsed.video = parseVideoStream(stream);
        }
        break;

      case 'audio':
        parsed.audios.push(parseAudioStream(stream));
        break;

      case 'subtitle':
        parsed.subtitles.push(parseSubtitleStream(stream));
        break;
    }
  }

  return parsed;
}

/**
 * Parses format output
 *
 * @param {MediaFormat} format
 * @returns {Bakaru.ParsedFormat}
 */
export function parseFormat(format: MediaFormat): Bakaru.ParsedFormat {
  const parsed: Bakaru.ParsedFormat = {
    duration: 0,
    size: 0
  };

  if (format.duration) {
    parsed.duration = parseFloat(format.duration);
  }

  if (format.size) {
    parsed.size = parseInt(format.size, 10);
  }

  return parsed;
}

/**
 * Parses chapters to suitable objects
 *
 * @param {MediaChapter[]} chapters
 * @returns {Bakaru.Chapter[]}
 */
export function parseChapters(chapters: MediaChapter[]): Bakaru.Chapter[] {
  if (chapters.length === 0) {
    return [];
  }

  return chapters.map(rawChapter => {
    let title = '';

    // An attempt to get fine title for chapter
    if (rawChapter.tags) {
      if (rawChapter.tags.title) {
        title = rawChapter.tags.title.toString().trim();
      }
    }

    const start = parseTime(rawChapter.start_time);
    const end = parseTime(rawChapter.end_time);

    return {
      end,
      start,
      title
    };
  });
}

/**
 * Parses output from ffprobe
 *
 * @param {Media} media
 * @returns {Bakaru.ParsedMedia}
 */
export default function parse(media: Media): Bakaru.ParsedMedia {
  const chapters = parseChapters(media.chapters);
  const { video, audios, subtitles } = parseStreams(media.streams);
  const { duration, size } = parseFormat(media.format);

  return {
    size,
    video,
    audios,
    duration,
    chapters,
    subtitles
  };
}
