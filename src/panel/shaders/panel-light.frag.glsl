#version 300 es
precision highp float;

uniform vec2 uResolution;
uniform vec2 uGlint;
uniform int uTheme;

out vec4 outColor;

float hash(vec2 p) {
	p = fract(p * vec2(127.1, 311.7));
	p += dot(p, p + 19.19);
	return fract(p.x * p.y);
}

float ellipse(vec2 uv, vec2 center, vec2 radius) {
	vec2 delta = (uv - center) / radius;
	return smoothstep(1.0, 0.0, dot(delta, delta));
}

void main() {
	vec2 uv = gl_FragCoord.xy / max(uResolution, vec2(1.0));
	vec2 topUv = vec2(uv.x, 1.0 - uv.y);
	float edgeFade = smoothstep(0.0, 0.018, min(min(topUv.x, 1.0 - topUv.x), min(topUv.y, 1.0 - topUv.y)));

	float glint = ellipse(topUv, uGlint, vec2(0.42, 0.34));
	float sheenA = ellipse(topUv, vec2(0.22, 0.04), vec2(0.46, 0.24));
	float sheenB = ellipse(topUv, vec2(0.74, 0.02), vec2(0.42, 0.22));
	float grain = hash(gl_FragCoord.xy) - 0.5;

	vec3 glintColor = uTheme == 1 ? vec3(1.0) : vec3(0.84, 0.92, 1.0);
	vec3 sheenColorA = uTheme == 1 ? vec3(0.2, 0.37, 0.74) : vec3(0.63, 0.82, 1.0);
	vec3 sheenColorB = uTheme == 1 ? vec3(0.16, 0.44, 0.3) : vec3(0.42, 0.82, 0.78);

	float glintAlpha = glint * (uTheme == 1 ? 0.2 : 0.16);
	float sheenAlpha = (sheenA * (uTheme == 1 ? 0.08 : 0.14) + sheenB * (uTheme == 1 ? 0.06 : 0.12)) * 0.18;
	float alpha = clamp((glintAlpha + sheenAlpha) * edgeFade, 0.0, 0.26);
	vec3 color = glintColor * glintAlpha + sheenColorA * sheenA * 0.08 + sheenColorB * sheenB * 0.07;
	color += grain * (uTheme == 1 ? 0.006 : 0.008);

	outColor = vec4(clamp(color, 0.0, 1.0), alpha);
}
