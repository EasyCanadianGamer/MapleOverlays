import { useParams } from 'react-router-dom';
import ChatPreview from '../components/overlay/ChatPreview';
import LastfmAccountCard from '../components/overlay/LastfmAccountCard';
import NowPlayingPreview from '../components/overlay/NowPlayingPreview';
import OverlayEditor from '../components/overlay/OverlayEditor';

export default function OverlayEditorPage() {
  const { id = '' } = useParams<{ id: string }>();
  return (
    <OverlayEditor
      key={id}
      id={id}
      renderPreview={(kind, config) => (kind === 'chat' ? <ChatPreview config={config} /> : <NowPlayingPreview config={config} />)}
      renderExtras={kind => (kind === 'nowplaying' ? <LastfmAccountCard /> : null)}
    />
  );
}
