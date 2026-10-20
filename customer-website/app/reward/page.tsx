import type {Metadata} from 'next';
import PrivateVisit from '@/components/PrivateVisit';
export const metadata:Metadata={title:'Your reward | RestroQR',robots:{index:false,follow:false},referrer:'no-referrer'};
export default function RewardPage(){return <PrivateVisit kind="reward"/>;}
