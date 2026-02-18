export function makeStageHandlers({
  setSelectedId, setStagePos, setStageScale, presence, objects,
}) {
  const handleMouseMove = (e) => {
    if (!presence.updateCursor) return;
    const stage = e.target.getStage();
    const pointer = stage.getPointerPosition();
    if (pointer) {
      // Correct for panning and zooming
      const pos = {
        x: (pointer.x - stage.x()) / stage.scaleX(),
        y: (pointer.y - stage.y()) / stage.scaleY(),
      };
      presence.updateCursor(pos.x, pos.y);
    }
  };

  const handleWheel = (e) => {
    e.evt.preventDefault();
    const scaleBy = 1.05;
    const stage = e.target.getStage();
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;

    setStageScale(newScale);
    setStagePos({
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    });
  };

  const handleStageClick = (e) => {
    if (e.target === e.target.getStage() || e.target.name() === 'bg-rect') {
      setSelectedId(null);
    }
  };

  const handleRecenter = () => {
    const items = Object.values(objects);
    if (!items.length) {
      setStagePos({ x: 0, y: 0 });
      setStageScale(1);
      return;
    }
    const HEADER_HEIGHT = 50;
    const PADDING = 60;
    const viewW = window.innerWidth;
    const viewH = window.innerHeight - HEADER_HEIGHT;

    const minX = Math.min(...items.map(o => o.x));
    const minY = Math.min(...items.map(o => o.y));
    const maxX = Math.max(...items.map(o => o.x + (o.width ?? 150)));
    const maxY = Math.max(...items.map(o => o.y + (o.height ?? 150)));

    const contentW = maxX - minX;
    const contentH = maxY - minY;

    const scale = Math.min(
      (viewW - PADDING * 2) / contentW,
      (viewH - PADDING * 2) / contentH,
      1
    );

    setStageScale(scale);
    setStagePos({
      x: (viewW - contentW * scale) / 2 - minX * scale,
      y: (viewH - contentH * scale) / 2 - minY * scale + HEADER_HEIGHT,
    });
  };

  return { handleMouseMove, handleWheel, handleStageClick, handleRecenter };
}
