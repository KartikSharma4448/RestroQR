import type {Metadata} from 'next';
import PrivateVisit from '@/components/PrivateVisit';
export const metadata:Metadata={title:'Review your visit | RestroQR',robots:{index:false,follow:false},referrer:'no-referrer'};
export default function VisitPage(){return <PrivateVisit kind="review"/>;}
