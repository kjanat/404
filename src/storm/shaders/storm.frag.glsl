#version 300 es
precision highp float;

const int MAX_BOLT_SEGMENTS = 72;

uniform vec2 uResolution;
uniform float uTime;
uniform float uFlash;
uniform float uRegionDim;
uniform float uBoltIntensity;
uniform int uTheme;
uniform int uBoltSegmentCount;
uniform vec4 uBoltSegments[MAX_BOLT_SEGMENTS];
uniform vec2 uBoltData[MAX_BOLT_SEGMENTS];

out vec4 outColor;

float hash(vec2 p) {
	p = fract(p * vec2(123.34, 456.21));
	p += dot(p, p + 45.32);
	return fract(p.x * p.y);
}

float noise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	vec2 u = f * f * (3.0 - 2.0 * f);

	float a = hash(i);
	float b = hash(i + vec2(1.0, 0.0));
	float c = hash(i + vec2(0.0, 1.0));
	float d = hash(i + vec2(1.0, 1.0));

	return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
	float value = 0.0;
	float amplitude = 0.5;
	mat2 rotate = mat2(0.8, -0.6, 0.6, 0.8);

	for (int i = 0; i < 5; i++) {
		value += amplitude * noise(p);
		p = rotate * p * 2.02 + 17.13;
		amplitude *= 0.52;
	}

	return value;
}

float segmentDistance(vec2 p, vec2 a, vec2 b) {
	vec2 pa = p - a;
	vec2 ba = b - a;
	float h = clamp(dot(pa, ba) / max(dot(ba, ba), 0.00001), 0.0, 1.0);
	return length(pa - ba * h);
}

void main() {
	vec2 uv = gl_FragCoord.xy / max(uResolution, vec2(1.0));
	vec2 topUv = vec2(uv.x, 1.0 - uv.y);
	float aspect = uResolution.x / max(uResolution.y, 1.0);
	float time = uTime * 0.001;

	vec3 skyTop = uTheme == 1 ? vec3(0.78, 0.85, 0.94) : vec3(0.025, 0.035, 0.08);
	vec3 skyBottom = uTheme == 1 ? vec3(0.94, 0.96, 0.985) : vec3(0.08, 0.095, 0.16);
	vec3 cloudTint = uTheme == 1 ? vec3(0.32, 0.39, 0.52) : vec3(0.42, 0.52, 0.72);
	vec3 boltCore = uTheme == 1 ? vec3(0.08, 0.22, 0.58) : vec3(0.95, 0.98, 1.0);
	vec3 boltGlow = uTheme == 1 ? vec3(0.16, 0.44, 0.82) : vec3(0.35, 0.68, 1.0);

	float horizon = smoothstep(-0.15, 1.05, topUv.y);
	vec3 color = mix(skyTop, skyBottom, horizon);

	vec2 driftA = topUv * vec2(2.1, 1.45) + vec2(time * 0.032, -time * 0.018);
	vec2 driftB = topUv * vec2(4.7, 2.9) + vec2(-time * 0.021, time * 0.024);
	float cloud = fbm(driftA);
	float detail = fbm(driftB);
	float shelf = smoothstep(0.18, 0.9, topUv.y);
	float cloudMass = smoothstep(0.38, 0.82, cloud * 0.72 + detail * 0.36 + shelf * 0.18);
	float cellNoise = fbm(topUv * vec2(3.4, 2.2) + vec2(9.0, time * 0.03));
	float stormCell = smoothstep(0.28, 0.95, cellNoise + cloudMass * 0.4);
	float dim = clamp(uRegionDim, 0.0, 1.0);

	color = mix(color, cloudTint, cloudMass * (uTheme == 1 ? 0.22 : 0.34));
	color *= 1.0 - dim * stormCell * (uTheme == 1 ? 0.42 : 0.62);

	float vignette = smoothstep(0.82, 0.18, distance(topUv, vec2(0.5, 0.5)));
	color *= mix(0.72, 1.08, vignette);

	float core = 0.0;
	float glow = 0.0;
	float sheet = 0.0;
	vec2 p = vec2(topUv.x * aspect, topUv.y);

	for (int i = 0; i < MAX_BOLT_SEGMENTS; i++) {
		if (i >= uBoltSegmentCount) {
			break;
		}

		vec4 segment = uBoltSegments[i];
		vec2 data = uBoltData[i];
		vec2 a = vec2(segment.x * aspect, segment.y);
		vec2 b = vec2(segment.z * aspect, segment.w);
		float d = segmentDistance(p, a, b);
		float width = max(data.x / max(uResolution.y, 1.0), 0.0008);
		float strength = data.y * uBoltIntensity;

		core += exp(-pow(d / width, 2.0)) * strength;
		glow += exp(-d / (width * 10.0)) * strength;
		sheet += exp(-d / (width * 34.0)) * strength;
	}

	float flash = clamp(uFlash, 0.0, 1.2);
	float cloudFlash = flash * (0.22 + cloudMass * 0.62 + stormCell * 0.28);
	float boltCoreMask = clamp(core * 1.2, 0.0, 1.0);
	float boltGlowMask = clamp(glow * 0.55 + sheet * 0.08, 0.0, 1.0);

	color += boltGlow * boltGlowMask;
	color = mix(color, boltCore, boltCoreMask);
	color += boltGlow * sheet * 0.08;
	color += (uTheme == 1 ? vec3(0.16, 0.23, 0.34) : vec3(0.45, 0.6, 0.82)) * cloudFlash;

	float grain = hash(gl_FragCoord.xy + floor(uTime * 0.02)) - 0.5;
	color += grain * (uTheme == 1 ? 0.012 : 0.018);

	float alpha = uTheme == 1 ? 0.78 : 0.88;
	outColor = vec4(clamp(color, 0.0, 1.0), alpha);
}
