import { setupCanvas, RenderContext } from 'webgl-video-renderer';
import * as WebChimera from "../../../typings/webchimera";

export interface Media {
  videoPath: string,
  audioPath?: string,
  audioIndex?: number,
  videoFrameSize?: number[]
}

export default class PlayerController {

  protected renderContext: RenderContext;
  protected video: WebChimera.VlcPlayer;
  protected audio: WebChimera.VlcPlayer;

  protected audioTrackIndex: number;
  protected videoFrameSize?: number[];
  protected isExternalAudio: boolean;
  protected externalAudioOffset: number;

  /**
   * Ctor
   */
  constructor(
    protected wcjs: WebChimera.WebChimera,
    protected canvas: HTMLCanvasElement,
    protected volume: number = 100
  ) {
    this.renderContext = this._createRenderContext(canvas);

    this.video = wcjs.createPlayer();
    this.audio = wcjs.createPlayer();
    this.volume = volume;

    this.audioTrackIndex = 1;
    this.videoFrameSize = null;
    this.isExternalAudio = false;
    this.externalAudioOffset = 0;

    this._registerOnFrameHandler();
    this._registerOnFrameSetupHandler();
  }

  /**
   * Set external audio track time offset
   *
   * @param {number} offset
   */
  setExternalAudioOffset(offset: number) {
    this.externalAudioOffset = offset;

    if (this.isExternalAudio) {
      this.audio.time += offset;
    }
  }

  /**
   * Set media to play
   *
   * @param videoPath
   * @param audioPath
   * @param audioIndex
   * @param videoFrameSize
   */
  setMedia({videoPath, audioPath = null, audioIndex = 0, videoFrameSize = null}: Media) {
    this.videoFrameSize = videoFrameSize;

    this.video.playlist.clear();
    this.audio.playlist.clear();

    this.video.playlist.add(videoPath);

    this.isExternalAudio = !!audioPath;
    this.isExternalAudio && this.audio.playlist.add(audioPath);

    if (!this.isExternalAudio) {
      this.audioTrackIndex = audioIndex + 1;
    }

    this.setVolume(this.volume);
    this._resizeCanvas();
  }

  /**
   * Swap audio track
   *
   * @param {string|boolean} audioPath
   * @param {number} audioIndex
   */
  swapAudio(audioPath: string = null, audioIndex: number = 0) {
    this.audio.playlist.clear();
    this.isExternalAudio = !!audioPath;

    if (audioPath) {
      this.audio.playlist.add(audioPath);

      if (this.video.state === 3) {
        this.audio.play();
      }

      this.setTime(this.video.time);
    } else {
      this.video.audio.track = this.audioTrackIndex = audioIndex + 1;
    }

    this.setVolume(this.volume);
  }

  /**
   * Sets playback time
   *
   * @param {number} time in milliseconds
   */
  setTime(time: number) {
    this.video.time = time;

    if (this.isExternalAudio) {
      this.audio.time = this.video.time + this.externalAudioOffset;
    }
  }

  /**
   * Sets volume
   *
   * @param {number} volume between 0 and 100
   */
  setVolume(volume: number) {
    this.volume = volume;

    if (this.isExternalAudio) {
      this.audio.volume = this.volume;
      this.video.volume = 0;
    } else {
      this.video.volume = this.volume;
      this.audio.volume = 0;
    }
  }

  /**
   * Continue playback
   */
  play() {
    this.video.play();
    this.isExternalAudio && this.audio.play();
  }

  /**
   * Pause playback
   */
  pause() {
    this.video.pause();
    this.isExternalAudio && this.audio.pause();
  }

  /**
   * Stops playback
   */
  stop() {
    this.video.stop();
    this.isExternalAudio && this.audio.stop();
  }

  /**
   * Toggles pause/play of playback
   */
  togglePause() {
    this.video.togglePause();
    this.isExternalAudio && this.audio.togglePause();
  }

  /**
   * Draws black frame on the canvas
   */
  drawBlackFrame() {
    this.renderContext.fillBlack();
  }

  /**
   * Register callback to fire on video length change
   *
   * @param cb
   */
  registerOnLengthHandler(cb: (length: number) => void) {
    this.video.onLengthChanged = cb;
  }

  /**
   * Register callback to fire each time playback time change
   *
   * @callback cb
   */
  registerOnTimeChangeHandler(cb: (time: number) => void) {
    this.video.onTimeChanged = cb;
  }

  /**
   * Register callback to fire when buffering happens
   *
   * @callback cb
   */
  registerOnBufferingHandler(cb: (percents: number) => void) {
    this.video.onBuffering = cb;
  }

  /**
   * Register callback to fire on video end
   *
   * @callback cb
   */
  registerOnEndReachedHandler(cb: () => void) {
    this.video.onEndReached = cb;
  }

  /**
   * Creates WebGL render context
   *
   * @param canvasElement
   * @returns {*}
   * @private
   */
  _createRenderContext(canvasElement: HTMLCanvasElement) {
    return setupCanvas(canvasElement, {
      preserveDrawingBuffer: true
    });
  }

  /**
   * Handles frame setup event to define video frame dimensions
   *
   * @private
   */
  _registerOnFrameSetupHandler() {
    this.video.onFrameSetup = (frameWidth, frameHeight) => {
      if (this.videoFrameSize === null) {
        this.videoFrameSize = [frameWidth, frameHeight];
        this._resizeCanvas();
      }

      if (!this.isExternalAudio) {
        this.video.audio.track = this.audioTrackIndex;
      }
    };
  }

  /**
   * Handles new frame came from video player
   *
   * @private
   */
  _registerOnFrameHandler() {
    const gl = this.renderContext.gl;

    this.video.onFrameReady = (frame: WebChimera.VideoFrame) => {
      gl.y.fill(frame.width, frame.height, frame.subarray(0, frame.uOffset));
      gl.u.fill(frame.width >> 1, frame.height >> 1, frame.subarray(frame.uOffset, frame.vOffset));
      gl.v.fill(frame.width >> 1, frame.height >> 1, frame.subarray(frame.vOffset, frame.length));

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    window.addEventListener('resize', this._resizeCanvas.bind(this));
  }

  /**
   * Properly resize canvas
   *
   * @private
   */
  _resizeCanvas() {
    const gl = this.renderContext.gl;
    const windowRatio = window.outerWidth / window.outerHeight;
    const frameRatio = this.videoFrameSize[0] / this.videoFrameSize[1];

    let canvasWidth = 0;
    let canvasHeight = 0;

    if (windowRatio > frameRatio) {
      canvasHeight = window.outerHeight;
      canvasWidth = Math.ceil(canvasHeight * frameRatio);
    } else {
      canvasWidth = window.outerWidth;
      canvasHeight = Math.ceil(canvasWidth / frameRatio);
    }

    this.canvas.width = canvasWidth;
    this.canvas.height = canvasHeight;
    gl.viewport(0, 0, canvasWidth, canvasHeight);
  }
}
