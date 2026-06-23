import type { Registry } from '../core/types';
import { ethernet } from './ethernet';
import { ipv4 } from './ipv4';
import { tcp } from './tcp';
import { udp } from './udp';
import { arp } from './arp';
import { icmp } from './icmp';
import { ipv6 } from './ipv6';
import { icmpv6 } from './icmpv6';
import { dns } from './dns';
import { dhcp } from './dhcp';
import { http } from './http';
import { tls } from './tls';
import { quic } from './quic';
import { vlan } from './vlan';
import { gre } from './gre';
import { ospf } from './ospf';
import { igmp } from './igmp';
import { smb2 } from './smb2';
import { ntp } from './ntp';
import { rtp } from './rtp';
import { tftp } from './tftp';
import { snmp } from './snmp';
import { ssh } from './ssh';
import { ftp } from './ftp';
import { smtp } from './smtp';
import { pop3 } from './pop3';
import { imap } from './imap';
import { telnet } from './telnet';
import { sip } from './sip';
import { sctp } from './sctp';
import { esp } from './esp';
import { ah } from './ah';
import { vrrp } from './vrrp';
import { bgp } from './bgp';
import { lldp } from './lldp';
import { eapol } from './eapol';
import { pppoe } from './pppoe';
import { vxlan } from './vxlan';
import { wireguard } from './wireguard';
import { mqtt } from './mqtt';
import { modbus } from './modbus';
import { radius } from './radius';
import { syslog } from './syslog';
import { dhcpv6 } from './dhcpv6';
import { llmnr } from './llmnr';
import { nbns } from './nbns';
import { kerberos } from './kerberos';
import { ldap } from './ldap';
import { tacacs } from './tacacs';
import { dtls } from './dtls';
import { isakmp } from './isakmp';
import { coap } from './coap';
import { ssdp } from './ssdp';
import { rip } from './rip';
import { eigrp } from './eigrp';
import { pim } from './pim';
import { isis } from './isis';
import { hsrp } from './hsrp';
import { stp } from './stp';
import { cdp } from './cdp';
import { mpls } from './mpls';
import { l2tp } from './l2tp';
import { ppp } from './ppp';
import { rtcp } from './rtcp';
import { diameter } from './diameter';
import { amqp } from './amqp';
import { sunrpc } from './sunrpc';
import { iscsi } from './iscsi';
import { ptp } from './ptp';
import { gtp } from './gtp';
import { bacnet } from './bacnet';
import { dnp3 } from './dnp3';
import { stun } from './stun';
import { smb1 } from './smb1';
import { rdp } from './rdp';
import { rfb } from './rfb';
import { irc } from './irc';
import { xmpp } from './xmpp';
import { whois } from './whois';
import { socks } from './socks';
import { websocket } from './websocket';
import { rarp } from './rarp';
import { dccp } from './dccp';
import { http2 } from './http2';
import { redis } from './redis';
import { mysql } from './mysql';
import { postgres } from './postgres';
import { mongodb } from './mongodb';
import { rtsp } from './rtsp';
import { bfd } from './bfd';
import { netflow } from './netflow';
import { geneve } from './geneve';
import { fcoe } from './fcoe';

/** Register every protocol the app knows about. Add new protocols here. */
export function registerCoreProtocols(registry: Registry): void {
  const all = [
    ethernet, ipv4, tcp, udp, arp, icmp, ipv6, icmpv6, dns, dhcp, http, tls, quic,
    vlan, gre, ospf, igmp, smb2, ntp, rtp, tftp, snmp, ssh, ftp, smtp, pop3, imap, telnet, sip,
    sctp, esp, ah, vrrp, bgp, lldp, eapol, pppoe, vxlan, wireguard, mqtt, modbus, radius, syslog,
    dhcpv6, llmnr, nbns, kerberos, ldap, tacacs, dtls, isakmp, coap, ssdp,
    rip, eigrp, pim, isis, hsrp, stp, cdp, mpls, l2tp, ppp,
    rtcp, diameter, amqp, sunrpc, iscsi, ptp, gtp, bacnet, dnp3, stun,
    smb1, rdp, rfb, irc, xmpp, whois, socks, websocket, rarp, dccp,
    http2, redis, mysql, postgres, mongodb, rtsp, bfd, netflow, geneve, fcoe,
  ];
  for (const spec of all) registry.register(spec);
}

export { ethernet, ipv4, tcp, udp, arp, icmp, ipv6, icmpv6, dns, dhcp, http, tls, quic };
export { vlan, gre, ospf, igmp, smb2, ntp, rtp, tftp, snmp, ssh, ftp, smtp, pop3, imap, telnet, sip };
export { sctp, esp, ah, vrrp, bgp, lldp, eapol, pppoe, vxlan, wireguard, mqtt, modbus, radius, syslog };
export { dhcpv6, llmnr, nbns, kerberos, ldap, tacacs, dtls, isakmp, coap, ssdp };
export { rip, eigrp, pim, isis, hsrp, stp, cdp, mpls, l2tp, ppp };
export { rtcp, diameter, amqp, sunrpc, iscsi, ptp, gtp, bacnet, dnp3, stun };
export { smb1, rdp, rfb, irc, xmpp, whois, socks, websocket, rarp, dccp };
export { http2, redis, mysql, postgres, mongodb, rtsp, bfd, netflow, geneve, fcoe };
