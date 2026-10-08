import React from 'react';
import {Composition, Still} from 'remotion';
import config from '../promo.config';
import {Promo} from './Promo';
import {Cover} from './Cover';
import {Avatar} from './Avatar';
import {RulesPost} from './RulesPost';
import './fonts';

const fps = config.video.fps;
const durationInFrames = Math.round(config.video.durationSec * fps);

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="Promo-Vertical"
      component={Promo}
      width={1080}
      height={1920}
      fps={fps}
      durationInFrames={durationInFrames}
    />
    <Composition
      id="Promo-Horizontal"
      component={Promo}
      width={1920}
      height={1080}
      fps={fps}
      durationInFrames={durationInFrames}
    />
    <Still id="Cover-Vertical" component={Cover} width={1080} height={1920} />
    <Still id="Cover-Horizontal" component={Cover} width={1280} height={720} />
    <Still id="Avatar" component={Avatar} width={1080} height={1080} />
    <Still id="RulesPost" component={RulesPost} width={1080} height={1350} />
  </>
);
