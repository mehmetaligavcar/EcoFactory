 
precision mediump float;

uniform float elapsedTime;
uniform sampler2D textureSampler;

varying vec4 color;
varying vec2 texCoord;

void main(void) {
    
    vec4 tex = texture2D(textureSampler, vec2(texCoord.s, texCoord.t));
    gl_FragColor = abs(sin(vec4(tex.xyz + color.xyz + elapsedTime, 1.0)));
}
