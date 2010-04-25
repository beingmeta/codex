/* Building the TOC */

var sbook_scanned=false;
var sbook_trace_scan=false;

function sbookPubCrawl(body,tocinfo,taginfo)
{
  var start=new Date();
  if (_sbook_toc_built) return false;
  if (sbook_trace_startup>0)
    fdjtLog("[%fs] Starting to gather metadata from DOM",fdjtET());
  var children=body.childNodes, level=false;
  var rootinfo={};
  var scanstate=
    {curlevel: 0,idserial:0,location: 0,
     tagstack: [],taggings: [],
     idstate: {prefix: false,count: 0},
     idstack: [{prefix: false,count: 0}]};
  scanstate.idstate.prefix=sbook_baseid;
  scanstate.idstack[0].prefix=sbook_baseid;
  scanstate.curhead=root; scanstate.curinfo=rootinfo;
  scanstate.knowlet=knowlet;
  if (body.id) tocinfo[body.id]=rootinfo;
  // Location is an indication of distance into the document
  var location=0;
  rootinfo.title=body.title||document.title;
  rootinfo.starts_at=0;
  rootinfo.level=0; rootinfo.sub=new Array();
  rootinfo.head=false; rootinfo.heads=new Array();
  if (!(root.id)) root.id="SBOOKROOT";
  rootinfo.id=root.id;
  /* Build the metadata */
  var i=0; while (i<children.length) {
    var child=children[i++];
    if (!(child.sbookskip))
      sbook_scanner(child,scanstate,tocinfo,taginfo);} 
  var scaninfo=scanstate.curinfo;
  /* Close off all of the open spans in the TOC */
  while (scaninfo) {
    scaninfo.ends_at=scanstate.location;
    scaninfo=scaninfo.head;}
  var done=new Date();
  fdjtLog('[%fs] Finished gathering metadata in %f secs over %d/%d heads/nodes',
	  fdjtET(),(done.getTime()-start.getTime())/1000,
	  sbook_heads.length,sbook_nodes.length);
  _sbook_toc_built=true;
  return scanstate;
}

function sbookTOCTitle(head)
{
  var title=
    (head.toctitle)||
    child.getAttributeNS('toctitle','http://sbooks.net')||
    child.getAttribute('toctitle')||
    child.getAttribute('data-toctitle')||
    child.title;
  if (!(title))
    return fdjtTextify(head,true);
  else if (typeof title === "string") {
    var std=fdjtStdSpace(title);
    if (std==="") return false;
    else return std;}
  else return fdjtTextify(title,true);
}

function sbookTextWidth(elt)
{
  if (elt.nodeType===3) return elt.nodeValue.length;
  else if (elt.nodeType===1) {
    var children=elt.childNodes; var loc=0;
    var i=0; var len=children.length;
    while (i<len) {
      var child=children[i++];
      if (child.nodeType===3) loc=loc+child.nodeValue.length;
      else if (child.nodeType===1)
	loc=loc+sbookTextWidth(child);
      else {}}
    return loc;}
  else return 0;
}

function sbookTOCLevel(elt)
{
  if (elt.toclevel) return elt.toclevel;
  var attrval=
    child.getAttributeNS('toclevel','http://sbooks.net')||
    child.getAttribute('toclevel')||child.getAttribute('data-toclevel');
  if (attrval) return parseInt(attrval);
  if (elt.className) {
    var cname=elt.className;
    var tocloc=cname.search(/sbook\dhead/);
    if (tocloc>=0) return parseInt(cname.slice(5,6));}
  if (elt.tagName.search(/H\d/)==0)
    return parseInt(elt.tagName.slice(1,2));
  else return false;
}

function _sbook_process_head(head,tocinfo,scanstate,
			     level,curhead,curinfo,curlevel)
{
  var headid=head.id;
  var headinfo=tocinfo[headid];
  if (!(headinfo)) headinfo=tocinfo[headid]={};
  if (sbook_debug_scan)
    fdjtLog("Scanning head item %o under %o at level %d w/id=#%s ",
	    head,curhead,level,headid);
  /* Iniitalize the headinfo */
  headinfo.starts_at=scanstate.location;
  headinfo.elt=head; headinfo.level=level;
  headinfo.sub=new Array(); headinfo.id=headid;
  headinfo.title=sbookTOCTitle(head);
  headinfo.next=false; headinfo.prev=false;
  if (level>curlevel) {
    /* This is the simple case where we are a subhead
       of the current head. */
    headinfo.sbook_head=curinfo;
    if (!(curinfo.intro_ends_at))
      curinfo.intro_ends_at=scanstate.location;
    curinfo.sub.push(headinfo);}
  else {
    /* We're not a subhead, so we're popping up at least one level. */
    var scan=curhead;
    var scaninfo=curinfo;
    var scanlevel=curinfo.level;
    /* Climb the stack of headers, closing off entries and setting up
       prev/next pointers where needed. */
    while (scaninfo) {
      if (debug_toc_build) /* debug_toc_build */
	fdjtLog("Finding head: scan=%o, info=%o, sbook_head=%o, cmp=%o",
		scan,scaninfo,scanlevel,scaninfo.sbook_head,
		(scanlevel<level));
      if (scanlevel<level) break;
      if (level===scanlevel) {
	headinfo.prev=scan;
	scaninfo.next=headinfo;}
      scaninfo.ends_at=scanstate.location;
      scanstate.tagstack=scanstate.tagstack.slice(0,-1);
      scaninfo=scaninfo.sbook_head;
      scanlevel=((scaninfo)?(scaninfo.level):(0));}
    if (debug_toc_build)
      fdjtLog("Found parent: up=%o, upinfo=%o, atlevel=%d, sbook_head=%o",
	      scan,scaninfo,scaninfo.level,scaninfo.sbook_head);
    /* We've found the head for this item. */
    headinfo.sbook_head=scaninfo;
    scaninfo.sub.push(headinfo);} /* handled below */
  /* Add yourself to your children's subsections */
  var supinfo=headinfo.sbook_head;
  var newheads=new Array();
  newheads=newheads.concat(supinfo.sbook_heads); newheads.push(supinfo);
  headinfo.sbook_heads=newheads;
  if ((trace_toc_build) || (debug_toc_build))
    fdjtLog("@%d: Found head=%o, headinfo=%o, sbook_head=%o",
	    scanstate.location,head,headinfo,headinfo.sbook_head);
  /* Update the toc state */
  scanstate.curhead=head;
  scanstate.curinfo=headinfo;
  scanstate.curlevel=level;
  if (headinfo)
    headinfo.head_ends_at=scanstate.location+fdjtFlatWidth(head);
  scanstate.location=scanstate.location+fdjtFlatWidth(head);  
}

function sbook_scanner(child,scanstate,tocinfo,taginfo)
{
  // fdjtTrace("scanner %o %o",scanstate,child);
  var location=scanstate.location;
  var curhead=scanstate.curhead;
  var curinfo=scanstate.curinfo;
  var curlevel=scanstate.curlevel;
  // Location tracking and TOC building
  if (child.nodeType===3) {
    var width=child.nodeValue.length;
    // Need to regularize whitespace
    scanstate.location=scanstate.location+width;
    return;}
  else if (child.nodeType!==1) return;
  else {}
  child.sbookloc=loc;
  child.sbookhead=curhead.id;
  if ((child.sbookskip)||(!(child.id))||
      ((child.className)&&(child.className.search(/\bsbookskip\b/)>=0)))
    return;
  var toclevel=sbookTOCLevel(child);
  var tags=child.getAttributeNS('tags','http://sbooks.net/')||
    child.getAttribute('tags')||child.getAttribute('data-tags');
  if (tags) taginfo[child.id]=tags.split(';');
  if (toclevel)
    _sbook_process_head(child,tocinfo,scanstate,
			toclevel,curhead,curinfo,curlevel);
  else {
    var children=child.childNodes;
    var i=0; var len=children.length;
    while (i<len) {
      var grandchild=children[i++];
      if (grandchild.nodeType===3)
	scanstate.location=scanstate.location+
	  grandchild.nodeValue.length;
      else if (grandchild.nodeType===1)
	sbook_scanner(grandchild,scanstate,tocinfo,taginfo);}}
}

