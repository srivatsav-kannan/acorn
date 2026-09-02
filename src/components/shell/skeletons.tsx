// Shape-matched loading skeletons, one per page, built from the same box
// geometry the real pages use so nothing jumps when content arrives. Solid
// pulsing blocks only, no gradient shimmer.

const Bar = ({ w = "100%", h = 14 }: { w?: string | number, h?: number }) => <span className="sk-bar" style={{ width: w, height: h }} />

const Heading = () => <div className="sk-heading"><Bar w={220} h={30} /><Bar w={340} h={13} /></div>

export const CalendarSkeleton = () => <div className="page sk-page" role="status" aria-busy="true" aria-label="Loading calendar">
  <div className="sk-row sk-between"><Heading /><div className="sk-controls"><Bar w={120} h={34} /><Bar w={170} h={34} /><Bar w={230} h={34} /></div></div>
  <div className="sk-calendar-layout">
    <div className="sk-card sk-grid-card">
      <div className="sk-weekdays">{Array.from({ length: 7 }, (_, index) => <Bar key={index} h={12} />)}</div>
      <div className="sk-lattice">{Array.from({ length: 35 }, (_, index) => <span className="sk-cell" key={index} />)}</div>
    </div>
    <div className="sk-side">
      <div className="sk-card sk-panel"><Bar w={90} h={18} /><Bar h={12} /><Bar w="70%" h={12} /></div>
      <div className="sk-card sk-panel"><div className="sk-row"><Bar w={70} h={24} /><Bar w={70} h={24} /></div><Bar h={12} /><Bar h={12} /><Bar w="80%" h={12} /><Bar h={12} /><Bar w="60%" h={12} /></div>
    </div>
  </div>
</div>

export const AcademicsSkeleton = () => <div className="page sk-page" role="status" aria-busy="true" aria-label="Loading academics">
  <Heading />
  <div className="sk-stats">{Array.from({ length: 4 }, (_, index) => <div className="sk-card sk-tile" key={index}><Bar w={70} h={26} /><Bar w={110} h={11} /></div>)}</div>
  <div className="sk-academics-layout">
    <div className="sk-main">
      <div className="sk-card sk-panel"><div className="sk-row"><Bar w={36} h={34} /><Bar w="55%" h={34} /><Bar w={36} h={34} /><Bar w={70} h={26} /></div>{Array.from({ length: 5 }, (_, index) => <div className="sk-row sk-between" key={index}><Bar w="45%" h={15} /><Bar w={110} h={13} /></div>)}</div>
      <div className="sk-card sk-panel"><Bar w={130} h={20} /><div className="sk-row"><Bar h={12} /><Bar h={12} /></div><Bar w="80%" h={12} /><Bar w="65%" h={12} /></div>
    </div>
    <div className="sk-card sk-panel"><div className="sk-row sk-between"><Bar w={90} h={20} /><Bar w={100} h={30} /></div><Bar h={38} />{Array.from({ length: 3 }, (_, index) => <Bar key={index} h={12} />)}</div>
  </div>
</div>

export const ActivitiesSkeleton = () => <div className="page sk-page" role="status" aria-busy="true" aria-label="Loading activities">
  <Heading />
  <div className="sk-academics-layout">
    <div className="sk-main">
      <div className="sk-row sk-between"><Bar w={140} h={20} /><Bar w={110} h={30} /></div>
      <Bar h={40} />
      <div className="sk-two-up">{Array.from({ length: 2 }, (_, index) => <div className="sk-card sk-panel" key={index}><Bar w={70} h={20} /><Bar w="60%" h={17} /><Bar h={12} /><Bar w="85%" h={12} /><Bar w="40%" h={12} /></div>)}</div>
    </div>
    <div className="sk-card sk-panel"><div className="sk-row sk-between"><Bar w={100} h={20} /><Bar w={36} h={20} /></div><Bar h={38} />{Array.from({ length: 3 }, (_, index) => <div key={index}><Bar w="50%" h={15} /><Bar h={11} /><Bar w="75%" h={11} /></div>)}</div>
  </div>
</div>

export const ScratchpadSkeleton = () => <div className="page sk-page" role="status" aria-busy="true" aria-label="Loading scratchpad">
  <Heading />
  <div className="sk-two-up">
    <div className="sk-card sk-panel"><Bar w={120} h={12} /><Bar w="70%" h={30} /><Bar w={160} h={12} /><Bar h={40} /></div>
    <div className="sk-card sk-panel"><Bar w="50%" h={20} /><Bar h={42} /><div className="sk-row"><Bar h={30} /><Bar w={150} h={34} /></div></div>
  </div>
  <Bar h={38} />
  <div className="sk-scratch-grid">{Array.from({ length: 6 }, (_, index) => <div className="sk-card sk-panel" key={index}><Bar w={54} h={17} /><Bar w="75%" h={17} /><Bar h={12} /><Bar w="85%" h={12} /><Bar w="35%" h={11} /></div>)}</div>
</div>

export const PanelSkeleton = () => <div className="page sk-page" role="status" aria-busy="true" aria-label="Loading">
  <Heading />
  <div className="sk-card sk-panel"><Bar w="40%" h={20} /><Bar h={13} /><Bar w="85%" h={13} /><Bar w="70%" h={13} /><Bar h={13} /><Bar w="55%" h={13} /></div>
</div>
