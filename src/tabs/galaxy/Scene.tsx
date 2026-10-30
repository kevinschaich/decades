// The Galaxy's 3D scene: every song a glowing star. The galaxy layout (songs about similar things sit together)
// becomes a swirling disk, and time is height: the 1950s at the bottom, today at the top. Loaded lazily.
import { OrbitControls } from '@react-three/drei'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from 'react'
import * as THREE from 'three'
import type { Song } from '../../data'
import { INK } from '../../theme'
import { oklchToRgb } from './color'
import { HEIGHT, RADIUS, hash, place } from './layout'

const BG = new THREE.Color().setRGB(...oklchToRgb(INK.bg), THREE.SRGBColorSpace)

const vertex = /* glsl */ `
    attribute vec3 color;
    attribute float size;
    attribute float hi;
    attribute float seed;
    uniform float uTime;
    uniform float uPixel;
    varying vec3 vColor;
    varying float vHi;
    void main() {
        vec3 p = position;
        p.y += sin(uTime * 0.35 + seed * 40.0) * 0.12;
        p.x += cos(uTime * 0.27 + seed * 23.0) * 0.08;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float tw = 0.85 + 0.15 * sin(uTime * (1.0 + seed * 2.0) + seed * 60.0);
        float grow = hi > 1.5 ? 2.2 : (hi < 0.5 ? 0.8 : 1.0);
        gl_PointSize = min(size * grow * tw * uPixel * (380.0 / -mv.z), 28.0 * uPixel);
        gl_Position = projectionMatrix * mv;
        vColor = color;
        vHi = hi;
    }
`
const fragment = /* glsl */ `
    varying vec3 vColor;
    varying float vHi;
    void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        if (d > 1.0) discard;
        float core = smoothstep(0.32, 0.0, d);
        float halo = exp(-d * d * 5.0) * 0.55;
        float a = (core + halo) * (vHi < 0.5 ? 0.2 : (vHi > 1.5 ? 1.4 : 0.8));
        vec3 c = mix(vColor, vec3(1.0), core * (vHi > 1.5 ? 0.75 : 0.45));
        gl_FragColor = vec4(c * a, a);
    }
`

type Props = {
    songs: Song[]
    colors: Float32Array
    /** Per song: 0 dimmed, 1 normal, 2 lit (selected, neighbor or search match). */
    highlight: Float32Array
    labels: { text: string; pos: [number, number, number]; color: string }[]
    focus: { index: number; nonce: number } | null
    selected: number | null
    neighbors: number[]
    onHover: (i: number | null, x: number, y: number) => void
    onSelect: (i: number | null) => void
}

function Stars({ songs, colors, highlight, onHover, onSelect }: Props) {
    const geom = useMemo(() => {
        const g = new THREE.BufferGeometry()
        const pos = new Float32Array(songs.length * 3)
        const size = new Float32Array(songs.length)
        const seed = new Float32Array(songs.length)
        songs.forEach((s, i) => {
            const h = hash(s.id)
            pos.set(place(s.galaxy!, s.year, h), i * 3)
            // Bigger hits glow brighter: rank 1 is the largest star.
            size[i] = 1.1 + 1.6 * (1 - Math.min(s.bestRank, 100) / 100) ** 2
            seed[i] = h
        })
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
        g.setAttribute('size', new THREE.BufferAttribute(size, 1))
        g.setAttribute('seed', new THREE.BufferAttribute(seed, 1))
        g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
        g.setAttribute('hi', new THREE.BufferAttribute(highlight, 1))
        g.computeBoundingSphere()
        return g
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [songs])
    useEffect(() => {
        geom.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    }, [geom, colors])
    useEffect(() => {
        geom.setAttribute('hi', new THREE.BufferAttribute(highlight, 1))
    }, [geom, highlight])

    const dpr = useThree((s) => s.viewport.dpr)
    const mat = useMemo(
        () =>
            new THREE.ShaderMaterial({
                vertexShader: vertex,
                fragmentShader: fragment,
                uniforms: { uTime: { value: 0 }, uPixel: { value: dpr } },
                transparent: true,
                depthWrite: false,
                blending: THREE.CustomBlending,
                blendSrc: THREE.OneFactor,
                blendDst: THREE.OneFactor,
            }),
        [dpr],
    )
    useFrame((_, dt) => (mat.uniforms.uTime.value += dt))

    const pick = (e: ThreeEvent<PointerEvent | MouseEvent>) => {
        let best: THREE.Intersection | null = null
        for (const h of e.intersections) {
            if (h.object !== e.object || h.index == null || highlight[h.index] < 0.5) continue
            if (!best || h.distanceToRay! < best.distanceToRay!) best = h
        }
        return best?.index ?? null
    }
    return (
        <points
            geometry={geom}
            material={mat}
            onPointerMove={(e) => {
                if (e.pointerType === 'touch') return
                const i = pick(e)
                onHover(i, e.nativeEvent.offsetX, e.nativeEvent.offsetY)
            }}
            onPointerOut={() => onHover(null, 0, 0)}
            onClick={(e) => {
                e.stopPropagation()
                onSelect(pick(e))
            }}
        />
    )
}

/** Faint background dust so the galaxy floats in space. */
function Dust() {
    const geom = useMemo(() => {
        const n = 2500
        const pos = new Float32Array(n * 3)
        for (let i = 0; i < n; i++) {
            const r = 120 + Math.random() * 200
            const u = Math.random() * 2 - 1, t = Math.random() * Math.PI * 2
            const k = Math.sqrt(1 - u * u)
            pos.set([r * k * Math.cos(t), r * u, r * k * Math.sin(t)], i * 3)
        }
        const g = new THREE.BufferGeometry()
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
        return g
    }, [])
    return (
        <points geometry={geom} raycast={() => null}>
            <pointsMaterial size={1.2} sizeAttenuation={false} color="#8a8fa8" transparent opacity={0.5} depthWrite={false} />
        </points>
    )
}

/** Lines from the selected star to its nearest neighbors. */
function Links({ songs, selected, neighbors }: Props) {
    const geom = useMemo(() => {
        const g = new THREE.BufferGeometry()
        if (selected == null) return g
        const a = place(songs[selected].galaxy!, songs[selected].year, hash(songs[selected].id))
        const pts: number[] = []
        for (const n of neighbors) pts.push(...a, ...place(songs[n].galaxy!, songs[n].year, hash(songs[n].id)))
        g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
        return g
    }, [songs, selected, neighbors])
    return (
        <lineSegments geometry={geom} raycast={() => null}>
            <lineBasicMaterial color="#ffffff" transparent opacity={0.35} blending={THREE.AdditiveBlending} depthWrite={false} />
        </lineSegments>
    )
}

/** Glides the camera to a song, stopping as soon as the person grabs the controls. */
function Fly({ songs, focus }: Props) {
    const controls = useThree((s) => s.controls) as unknown as { target: THREE.Vector3; addEventListener: (t: string, f: () => void) => void; removeEventListener: (t: string, f: () => void) => void; update: () => void } | null
    const camera = useThree((s) => s.camera)
    const goal = useRef<{ target: THREE.Vector3; cam: THREE.Vector3 } | null>(null)
    useEffect(() => {
        if (!focus || !controls) return
        const s = songs[focus.index]
        const target = new THREE.Vector3(...place(s.galaxy!, s.year, hash(s.id)))
        const dir = camera.position.clone().sub(controls.target).normalize()
        goal.current = { target, cam: target.clone().add(dir.multiplyScalar(28)) }
    }, [focus, controls, songs, camera])
    useEffect(() => {
        if (!controls) return
        const stop = () => (goal.current = null)
        controls.addEventListener('start', stop)
        return () => controls.removeEventListener('start', stop)
    }, [controls])
    useFrame((_, dt) => {
        const g = goal.current
        if (!g || !controls) return
        const k = 1 - Math.exp(-dt * 3)
        controls.target.lerp(g.target, k)
        camera.position.lerp(g.cam, k)
        controls.update()
        if (camera.position.distanceTo(g.cam) < 0.05) goal.current = null
    })
    return null
}

/** Frames the disk on load so it fills the view at any aspect ratio (phones crop the far edges a little). */
function Frame() {
    const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
    const size = useThree((s) => s.size)
    const controls = useThree((s) => s.controls)
    const done = useRef(false)
    useLayoutEffect(() => {
        if (done.current || !size.width || !controls) return
        done.current = true
        const aspect = size.width / size.height
        const t = Math.tan(((camera.fov / 2) * Math.PI) / 180)
        // Seen from ~30° above, the disk's height on screen is about R plus most of the time axis.
        const fitH = (RADIUS * 0.75 + HEIGHT * 0.4) / t
        const fitW = (RADIUS * (aspect < 1 ? 1.2 : 0.95)) / (t * aspect)
        const d = Math.max(fitH, fitW)
        const el = ((aspect < 1 ? 45 : 30) * Math.PI) / 180
        camera.position.set(0, d * Math.sin(el), d * Math.cos(el))
        ;(controls as unknown as { target: THREE.Vector3; update: () => void }).target.set(0, 0, 0)
        ;(controls as unknown as { update: () => void }).update()
    }, [camera, size, controls])
    return null
}

type Label = { text: string; pos: [number, number, number]; color: string }

/**
 * Projects the theme labels onto plain DOM nodes each frame. (drei's <Html> mounts a separate React root per
 * label, which tears down mid-render when the tab unmounts and throws removeChild errors.)
 */
function Labels({ labels, nodes }: { labels: Label[]; nodes: RefObject<(HTMLDivElement | null)[]> }) {
    const v = useMemo(() => new THREE.Vector3(), [])
    useFrame(({ camera, size }) => {
        labels.forEach((l, i) => {
            const el = nodes.current[i]
            if (!el) return
            v.set(...l.pos).project(camera)
            const hidden = v.z > 1 || Math.abs(v.x) > 1.2 || Math.abs(v.y) > 1.2
            el.style.display = hidden ? 'none' : ''
            el.style.transform = `translate(-50%, -50%) translate(${((v.x + 1) / 2) * size.width}px, ${((1 - v.y) / 2) * size.height}px)`
        })
    })
    return null
}

export default function Scene(props: Props) {
    const nodes = useRef<(HTMLDivElement | null)[]>([])
    return (
        <div className="relative h-full w-full">
            <Canvas
                className="h-full w-full touch-none"
                dpr={[1, 2]}
                camera={{ position: [0, 40, 70], fov: 55, near: 0.1, far: 1000 }}
                raycaster={{ params: { Points: { threshold: 0.6 } } as never }}
                onPointerMissed={() => props.onSelect(null)}
            >
                <color attach="background" args={[BG]} />
                <fog attach="fog" args={[BG, 90, 220]} />
                <Dust />
                <Stars {...props} />
                <Links {...props} />
                <Labels labels={props.labels} nodes={nodes} />
                <OrbitControls
                    makeDefault
                    enableDamping
                    dampingFactor={0.08}
                    autoRotate={props.selected == null}
                    autoRotateSpeed={0.25}
                    minDistance={4}
                    maxDistance={160}
                />
                <Frame />
                <Fly {...props} />
            </Canvas>
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                {props.labels.map((l, i) => (
                    <div
                        key={l.text}
                        ref={(el) => {
                            nodes.current[i] = el
                        }}
                        className="absolute top-0 left-0 whitespace-nowrap text-[10px] font-medium uppercase tracking-[0.18em] will-change-transform sm:text-[11px]"
                        style={{ display: 'none', color: l.color, textShadow: `0 0 12px ${INK.bg}, 0 0 4px ${INK.bg}`, opacity: props.selected == null ? 0.85 : 0.35 }}
                    >
                        {l.text}
                    </div>
                ))}
            </div>
        </div>
    )
}
