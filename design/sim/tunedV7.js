// 최종 기획서 확정안(V7) = V5 + 전체 체력 ×1.1, 뜨거운 박자 38박부터, 손잡기 ×15 상한 250
module.exports = Object.assign({}, require('./tunedV5.js'), { hpScale: 1.1, hotBeat: 38, handshakePer: 15, handshakeCap: 250 });
