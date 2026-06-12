/**
 * MoonSceneBlock — decorative pixel-art moon scene (astronaut + Clawd, the
 * Claude Code mascot) rendered in canvas world-space so it pans/zooms with
 * the board. Sprites are code-drawn via box-shadow pixels: no image assets.
 *
 * Day/golden: idle life — the astronaut periodically "thinks" (dot-by-dot
 * thought bubble) and rarely does a big moon hop; Clawd blinks, thinks in
 * terminal (`>_` bubble), and occasionally wiggles.
 *
 * Night (matches the canvas night backdrop via useTimeOfDayBlock): the two
 * of them DJ — deck with scratching records, beat-bobbing, floating notes,
 * and a pulsing "take a break" sign. All motion is pure CSS keyframes.
 */

import { useTimeOfDayBlock } from '@/components/lego_blocks/hooks/shared/useTimeOfDayBlock'
import { useMoonSceneMessagesBlock } from '@/components/lego_blocks/hooks/shared/useMoonSceneMessagesBlock'
import type { MoonSceneAnimationBlock } from '@/services/lego_blocks/units/vaultUiPreferencesBlock'

const PX = 5

const PALETTE: Record<string, string> = {
  W: '#f1f5f9', // suit white / bubble
  G: '#94a3b8', // suit gray
  V: '#38bdf8', // visor / blue accent
  D: '#0c4a6e', // visor shade
  O: '#e8855d', // clawd coral
  K: '#1e293b', // dark (eyes / glyphs / deck)
  R: '#f87171', // flag red / red accent
  S: '#cbd5e1', // pole silver / records
}

// Arms live in separate overlays so they can move while thinking / DJing.
const ASTRONAUT = [
  '....WWWW....',
  '...WWWWWW...',
  '..WWVVVVWW..',
  '..WWVVDDWW..',
  '..WWWWWWWW..',
  '...WWWWWW...',
  '...WWWWWW...',
  '...WWWWWW...',
  '...WWWWWW...',
  '...WWWWWW...',
  '...WWWWWW...',
  '...WWW.WWW..',
  '...GGW.WGG..',
  '...GG...GG..',
]

const ASTRONAUT_ARM_L = [
  '............',
  '............',
  '............',
  '............',
  '............',
  '............',
  '..G.........',
  '.WG.........',
  '.WG.........',
  '.W..........',
]

const ASTRONAUT_ARM_R = [
  '............',
  '............',
  '............',
  '............',
  '............',
  '............',
  '.........G..',
  '.........GW.',
  '.........GW.',
  '..........W.',
]

// Clawd — decoded from the reference sprite: inset ears, 1x2 slit eyes,
// arm band extending past the body, leg pairs under each side.
const CLAWD = [
  '....OO.....OO...',
  '...OOOOOOOOOOO..',
  '...OOOOOOOOOOO..',
  '...OOKOOOOOKOO..',
  '...OOKOOOOOKOO..',
  '...OOOOOOOOOOO..',
  '...OOOOOOOOOOO..',
  '...OOOOOOOOOOO..',
  '...OOOOOOOOOOO..',
  '....O.O...O.O...',
  '....O.O...O.O...',
]

// Clawd's nub arms, separate so they can flap.
const CLAWD_ARM_L = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '.OO.............',
  '.OO.............',
]

const CLAWD_ARM_R = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '..............OO',
  '..............OO',
]

// Coral pixels covering Clawd's eye slits — flashed briefly to blink.
const CLAWD_EYELIDS = [
  '................',
  '................',
  '................',
  '.....O.....O....',
  '.....O.....O....',
]

const FLAG = [
  'SRRRRRR',
  'SRRKKRR',
  'SRRRRRR',
  'S......',
  'S......',
  'S......',
  'S......',
  'S......',
]

// Empty thought bubble — the three dots are separate overlays so they can
// appear one at a time.
const THINK_BUBBLE = [
  '.WWWWWWWWW.',
  'WWWWWWWWWWW',
  'WWWWWWWWWWW',
  'WWWWWWWWWWW',
  '.WWWWWWWWW.',
  '..W........',
  '.W.........',
]

const THINK_DOT = ['K']

// Clawd's thought: a tiny terminal prompt `>_`.
const PROMPT_BUBBLE = [
  '.WWWWWWWW.',
  'WWKWWWWWWW',
  'WWWKWWWWWW',
  'WWKWWKKWWW',
  '.WWWWWWWW.',
  '...W......',
  '..W.......',
]

// DJ deck: two records flanking a mixer with buttons; stubby legs.
const DJ_DECK = [
  '.KKKKKKKKKKKKKKKKK.',
  '.KSSSSSKRVRKSSSSSK.',
  '.KSSSSSKVRVKSSSSSK.',
  '.KKKKKKKKKKKKKKKKK.',
  '..KK...........KK..',
  '..KK...........KK..',
]

// Record center dots — separate overlay that jitters side to side so the
// records look like they're being scratched.
const DJ_DISC_DOTS = [
  '...................',
  '...................',
  '....K..........K...',
]

// Double eighth-note, parameterized by color letter.
function noteRows(c: string): string[] {
  return [
    `.${c}${c}${c}${c}`,
    `.${c}..${c}`,
    `.${c}..${c}`,
    `.${c}..${c}`,
    `${c}${c}.${c}${c}`,
    `${c}${c}.${c}${c}`,
  ]
}

function spriteShadow(rows: string[], px: number): string {
  const shadows: string[] = []
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const color = PALETTE[row[x]]
      if (color) shadows.push(`${x * px}px ${y * px}px 0 ${color}`)
    }
  })
  return shadows.join(',')
}

function PixelSprite({ rows, px = PX }: { rows: string[]; px?: number }) {
  return (
    <div
      style={{
        width: px,
        height: px,
        boxShadow: spriteShadow(rows, px),
        // reserve full sprite bounds so parent sizing works
        marginRight: (rows[0].length - 1) * px,
        marginBottom: (rows.length - 1) * px,
      }}
    />
  )
}

// Pixel-styled speech bubble for scheduled messages; anchored above a sprite
// and grows upward with the text.
function SpeechBubbleBlock({ text }: { text: string }) {
  return (
    <div style={{ position: 'relative', width: 'max-content', maxWidth: 160 }}>
      <div
        style={{
          background: PALETTE.W,
          color: PALETTE.K,
          fontFamily: 'ui-monospace, monospace',
          fontSize: 10,
          fontWeight: 600,
          lineHeight: 1.45,
          padding: '6px 9px',
          border: `3px solid ${PALETTE.K}`,
          boxShadow: '0 3px 0 rgba(0,0,0,0.35)',
        }}
      >
        {text}
      </div>
      {/* tail */}
      <div
        style={{
          position: 'absolute',
          left: 10,
          bottom: -7,
          width: 10,
          height: 10,
          background: PALETTE.W,
          borderLeft: `3px solid ${PALETTE.K}`,
          borderBottom: `3px solid ${PALETTE.K}`,
          transform: 'rotate(-45deg)',
        }}
      />
    </div>
  )
}

// Body-level animations replace the idle bob/wiggle; arm-level ones (wave,
// cheer) keep the body idle and only override the arm overlays.
const MSG_BODY_ANIMATION: Partial<Record<MoonSceneAnimationBlock, string>> = {
  dance: 'moon-msg-dance 0.9s ease-in-out infinite',
  hop: 'moon-msg-hop 1.6s ease-in-out infinite',
  spin: 'moon-msg-spin 2.4s linear infinite',
}

export default function MoonSceneBlock({ x, y }: { x: number; y: number }) {
  const phase = useTimeOfDayBlock()
  const dj = phase === 'night'
  const activeMessages = useMoonSceneMessagesBlock()
  const astroMsg = activeMessages.astronaut
  const clawdMsg = activeMessages.clawd
  const astroAnim: MoonSceneAnimationBlock = astroMsg?.animation ?? 'none'
  const clawdAnim: MoonSceneAnimationBlock = clawdMsg?.animation ?? 'none'
  const astroBodyMsgAnimation = MSG_BODY_ANIMATION[astroAnim]
  const clawdBodyMsgAnimation = MSG_BODY_ANIMATION[clawdAnim]

  const surfaceW = 520
  const surfaceH = 110

  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: surfaceW,
        height: surfaceH + 130,
        pointerEvents: 'none',
        zIndex: 1,
      }}
    >
      <style>{`
        @keyframes moon-bob {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-7px); }
        }
        @keyframes moon-bob-slow {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-4px); }
        }
        @keyframes moon-flag-wave {
          0%, 100% { transform: skewY(0deg); }
          50%      { transform: skewY(-3deg); }
        }
        /* Quick double-blink, long pause. */
        @keyframes moon-blink {
          0%, 91.5%, 93.5%, 95.5%, 97.5%, 100% { opacity: 0; }
          92%, 93%, 96%, 97% { opacity: 1; }
        }
        /* Thought bubble: hidden most of the cycle, fades in, holds, fades. */
        @keyframes moon-think-bubble {
          0%, 33%  { opacity: 0; }
          36%, 76% { opacity: 1; }
          79%, 100% { opacity: 0; }
        }
        /* Dots inside the bubble pop in one at a time (staggered by delay). */
        @keyframes moon-think-dot {
          0%, 40%  { opacity: 0; }
          42%, 74% { opacity: 1; }
          77%, 100% { opacity: 0; }
        }
        /* Rare big low-gravity hop near the end of the idle cycle. */
        @keyframes moon-rare-hop {
          0%, 84% { transform: translateY(0); }
          88%     { transform: translateY(-18px); }
          93%     { transform: translateY(0); }
          95%     { transform: translateY(-5px); }
          97%, 100% { transform: translateY(0); }
        }
        /* Arms raise and waggle while the thought bubble is up (36%-76%). */
        @keyframes moon-arm-think-l {
          0%, 34%   { transform: rotate(0deg); }
          40%       { transform: rotate(-18deg); }
          48%       { transform: rotate(-10deg); }
          56%       { transform: rotate(-18deg); }
          64%       { transform: rotate(-10deg); }
          72%       { transform: rotate(-16deg); }
          78%, 100% { transform: rotate(0deg); }
        }
        @keyframes moon-arm-think-r {
          0%, 34%   { transform: rotate(0deg); }
          40%       { transform: rotate(18deg); }
          48%       { transform: rotate(10deg); }
          56%       { transform: rotate(18deg); }
          64%       { transform: rotate(10deg); }
          72%       { transform: rotate(16deg); }
          78%, 100% { transform: rotate(0deg); }
        }
        /* Clawd's nubs flap up and down while his bubble is up. */
        @keyframes moon-nub-think {
          0%, 36%   { transform: translateY(0); }
          41%       { transform: translateY(-5px); }
          46%       { transform: translateY(0); }
          51%       { transform: translateY(-5px); }
          56%       { transform: translateY(0); }
          61%       { transform: translateY(-5px); }
          66%       { transform: translateY(0); }
          71%       { transform: translateY(-4px); }
          76%, 100% { transform: translateY(0); }
        }
        /* Occasional happy wiggle. */
        @keyframes moon-wiggle {
          0%, 70% { transform: rotate(0deg); }
          74%     { transform: rotate(-7deg); }
          78%     { transform: rotate(7deg); }
          82%     { transform: rotate(-5deg); }
          86%, 100% { transform: rotate(0deg); }
        }

        /* --- night / DJ mode --- */
        @keyframes moon-dj-bob {
          from { transform: translateY(0); }
          to   { transform: translateY(-5px); }
        }
        @keyframes moon-arm-pump-l {
          from { transform: rotate(-8deg); }
          to   { transform: rotate(-30deg); }
        }
        @keyframes moon-arm-scratch {
          from { transform: rotate(6deg); }
          to   { transform: rotate(22deg); }
        }
        @keyframes moon-nub-flap {
          from { transform: translateY(0); }
          to   { transform: translateY(-5px); }
        }
        @keyframes moon-disc-scratch {
          0%, 48%  { transform: translateX(-${PX}px); }
          50%, 100% { transform: translateX(${PX}px); }
        }
        @keyframes moon-note-rise {
          0%   { transform: translateY(0); opacity: 0; }
          12%  { opacity: 1; }
          75%  { opacity: 1; }
          100% { transform: translateY(-48px); opacity: 0; }
        }
        @keyframes moon-sign-pulse {
          0%, 100% { opacity: 0.55; }
          50%      { opacity: 1; }
        }

        /* --- scheduled-message animation library --- */
        @keyframes moon-msg-dance {
          0%, 100% { transform: translateX(0) rotate(0deg); }
          25%      { transform: translateX(-4px) rotate(-6deg); }
          75%      { transform: translateX(4px) rotate(6deg); }
        }
        @keyframes moon-msg-hop {
          0%, 60%, 100% { transform: translateY(0); }
          30%           { transform: translateY(-14px); }
        }
        @keyframes moon-msg-spin {
          0%   { transform: scaleX(1); }
          25%  { transform: scaleX(0.1); }
          50%  { transform: scaleX(-1); }
          75%  { transform: scaleX(0.1); }
          100% { transform: scaleX(1); }
        }
        @keyframes moon-msg-wave {
          from { transform: rotate(15deg); }
          to   { transform: rotate(50deg); }
        }
        @keyframes moon-msg-cheer-l {
          from { transform: rotate(-35deg); }
          to   { transform: rotate(-58deg); }
        }
        @keyframes moon-msg-cheer-r {
          from { transform: rotate(35deg); }
          to   { transform: rotate(58deg); }
        }
        @keyframes moon-msg-bubble-float {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-4px); }
        }
      `}</style>

      {/* moon surface */}
      <svg
        width={surfaceW}
        height={surfaceH}
        viewBox={`0 0 ${surfaceW} ${surfaceH}`}
        style={{ position: 'absolute', left: 0, bottom: 0 }}
      >
        <ellipse cx={surfaceW / 2} cy={surfaceH + 60} rx={surfaceW / 2} ry={surfaceH} fill="#3f4459" />
        <ellipse cx={surfaceW / 2} cy={surfaceH + 64} rx={surfaceW / 2 - 14} ry={surfaceH - 6} fill="#4a4f66" />
        {/* craters */}
        <ellipse cx={110} cy={70} rx={26} ry={9} fill="#3a3f54" />
        <ellipse cx={110} cy={68} rx={26} ry={9} fill="#343950" />
        <ellipse cx={300} cy={92} rx={18} ry={6} fill="#3a3f54" />
        <ellipse cx={300} cy={90} rx={18} ry={6} fill="#343950" />
        <ellipse cx={420} cy={66} rx={22} ry={8} fill="#3a3f54" />
        <ellipse cx={420} cy={64} rx={22} ry={8} fill="#343950" />
      </svg>

      {dj ? (
        <>
          {/* DJ deck where the flag stands by day */}
          <div style={{ position: 'absolute', left: 206, bottom: 56 }}>
            <div style={{ position: 'relative' }}>
              <PixelSprite rows={DJ_DECK} />
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  animation: 'moon-disc-scratch 0.6s steps(1) infinite',
                }}
              >
                <PixelSprite rows={DJ_DISC_DOTS} />
              </div>
            </div>
          </div>

          {/* floating notes above the deck */}
          {[
            { left: 210, delay: 0, color: 'V' },
            { left: 248, delay: 0.7, color: 'R' },
            { left: 284, delay: 1.4, color: 'W' },
          ].map(n => (
            <div
              key={n.left}
              style={{
                position: 'absolute',
                left: n.left,
                bottom: 110,
                animation: `moon-note-rise 2.2s ease-out ${n.delay}s infinite`,
                opacity: 0,
              }}
            >
              <PixelSprite rows={noteRows(n.color)} px={3} />
            </div>
          ))}

          {/* take-a-break sign */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 2,
              textAlign: 'center',
              fontFamily: 'ui-monospace, monospace',
              fontSize: 11,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: '#cbd5e1',
              textShadow: '0 0 8px rgba(125,211,252,0.5)',
              animation: 'moon-sign-pulse 2.4s ease-in-out infinite',
            }}
          >
            ♪ take a break ♪
          </div>
        </>
      ) : (
        /* flag by day */
        <div
          style={{
            position: 'absolute',
            left: 250,
            bottom: 62,
            animation: 'moon-flag-wave 4s ease-in-out infinite',
            transformOrigin: 'bottom left',
          }}
        >
          <PixelSprite rows={FLAG} px={4} />
        </div>
      )}

      {/* astronaut */}
      <div
        style={{
          position: 'absolute',
          left: 140,
          bottom: 52,
          animation: dj || astroBodyMsgAnimation ? undefined : 'moon-rare-hop 18s ease-in-out infinite',
        }}
      >
        <div
          style={{
            position: 'relative',
            transformOrigin: 'bottom center',
            animation: astroBodyMsgAnimation
              ?? (dj
                ? 'moon-dj-bob 0.52s ease-in-out infinite alternate'
                : 'moon-bob 3.2s ease-in-out infinite'),
          }}
        >
          <PixelSprite rows={ASTRONAUT} />
          {/* arms: think-waggle by day, pump + scratch at night, message overrides */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              animation: astroAnim === 'wave'
                ? undefined
                : astroAnim === 'cheer'
                  ? 'moon-msg-cheer-l 0.5s ease-in-out infinite alternate'
                  : dj
                    ? 'moon-arm-pump-l 0.52s ease-in-out infinite alternate'
                    : 'moon-arm-think-l 18s ease-in-out infinite',
              transformOrigin: `${3 * PX}px ${6.5 * PX}px`,
            }}
          >
            <PixelSprite rows={ASTRONAUT_ARM_L} />
          </div>
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              animation: astroAnim === 'wave'
                ? 'moon-msg-wave 0.6s ease-in-out infinite alternate'
                : astroAnim === 'cheer'
                  ? 'moon-msg-cheer-r 0.5s ease-in-out infinite alternate'
                  : dj
                    ? 'moon-arm-scratch 0.26s ease-in-out infinite alternate'
                    : 'moon-arm-think-r 18s ease-in-out infinite',
              transformOrigin: `${9 * PX}px ${6.5 * PX}px`,
            }}
          >
            <PixelSprite rows={ASTRONAUT_ARM_R} />
          </div>
          {/* thought bubble floats up-right of the helmet (day only) */}
          {!dj && !astroMsg && (
            <div
              style={{
                position: 'absolute',
                left: 44,
                top: -34,
                animation: 'moon-think-bubble 18s ease-in-out infinite',
                opacity: 0,
              }}
            >
              <div style={{ position: 'relative' }}>
                <PixelSprite rows={THINK_BUBBLE} px={4} />
                {[0, 1, 2].map(i => (
                  <div
                    key={i}
                    style={{
                      position: 'absolute',
                      left: 12 + i * 8,
                      top: 8,
                      animation: `moon-think-dot 18s ease-in-out ${i * 0.9}s infinite`,
                      opacity: 0,
                    }}
                  >
                    <PixelSprite rows={THINK_DOT} px={4} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        {/* scheduled message speech bubble — outside the animated body so the
            text never mirrors or tilts with dance/spin */}
        {astroMsg && (
          <div
            style={{
              position: 'absolute',
              left: 40,
              bottom: ASTRONAUT.length * PX + 12,
              animation: 'moon-msg-bubble-float 3.2s ease-in-out infinite',
            }}
          >
            <SpeechBubbleBlock text={astroMsg.text} />
          </div>
        )}
      </div>

      {/* clawd */}
      <div
        style={{
          position: 'absolute',
          left: 312,
          bottom: 48,
          animation: clawdBodyMsgAnimation
            ? undefined
            : dj
              ? 'moon-dj-bob 0.52s ease-in-out 0.26s infinite alternate'
              : 'moon-bob-slow 2.6s ease-in-out infinite',
        }}
      >
        <div
          style={{
            position: 'relative',
            animation: clawdBodyMsgAnimation
              ?? (dj ? undefined : 'moon-wiggle 13s ease-in-out infinite'),
            transformOrigin: 'bottom center',
          }}
        >
          <PixelSprite rows={CLAWD} />
          {/* nub arms: flap while thinking by day, on the beat at night, message overrides */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              animation: clawdAnim === 'wave'
                ? undefined
                : clawdAnim === 'cheer'
                  ? 'moon-nub-flap 0.35s ease-in-out infinite alternate'
                  : dj
                    ? 'moon-nub-flap 0.4s ease-in-out infinite alternate'
                    : 'moon-nub-think 18s ease-in-out 9s infinite',
            }}
          >
            <PixelSprite rows={CLAWD_ARM_L} />
          </div>
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              animation: clawdAnim === 'wave'
                ? 'moon-nub-flap 0.3s ease-in-out infinite alternate'
                : clawdAnim === 'cheer'
                  ? 'moon-nub-flap 0.35s ease-in-out 0.17s infinite alternate'
                  : dj
                    ? 'moon-nub-flap 0.4s ease-in-out 0.2s infinite alternate'
                    : 'moon-nub-think 18s ease-in-out 9.4s infinite',
            }}
          >
            <PixelSprite rows={CLAWD_ARM_R} />
          </div>
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              animation: 'moon-blink 6s steps(1) infinite',
            }}
          >
            <PixelSprite rows={CLAWD_EYELIDS} />
          </div>
          {/* `>_` thought bubble, offset in time from the astronaut's (day only) */}
          {!dj && !clawdMsg && (
            <div
              style={{
                position: 'absolute',
                left: 58,
                top: -32,
                animation: 'moon-think-bubble 18s ease-in-out 9s infinite',
                opacity: 0,
              }}
            >
              <PixelSprite rows={PROMPT_BUBBLE} px={4} />
            </div>
          )}
        </div>
        {/* scheduled message speech bubble — outside the animated body so the
            text never mirrors or tilts with dance/spin */}
        {clawdMsg && (
          <div
            style={{
              position: 'absolute',
              left: 52,
              bottom: CLAWD.length * PX + 12,
              animation: 'moon-msg-bubble-float 2.6s ease-in-out infinite',
            }}
          >
            <SpeechBubbleBlock text={clawdMsg.text} />
          </div>
        )}
      </div>
    </div>
  )
}
