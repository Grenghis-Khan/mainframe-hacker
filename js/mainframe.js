/* ============================================
   MAINFRAME — HackerTyper Terminal Engine
   ============================================ */

const Mainframe = (() => {
  // Curated corpus — varied, cinematic hacker code (trimmed repetition)
  const CODE_LINES = [
    "#include <linux/kernel.h>",
    "#include <linux/module.h>",
    "#include <linux/init.h>",
    "#include <linux/kthread.h>",
    "#include <net/sock.h>",
    "#include <net/tcp.h>",
    "",
    "#define MAINFRAME_PORT    31337",
    "#define MAX_CONNECTIONS   1024",
    "#define CIPHER_KEY        0xDEADBEEF",
    "",
    'MODULE_LICENSE("CLASSIFIED");',
    'MODULE_AUTHOR("MAINFRAME_ADMIN");',
    "",
    "struct mainframe_connection {",
    "    struct socket *sock;",
    "    struct sockaddr_in addr;",
    "    unsigned char buf[BUFFER_SIZE];",
    "    int status;",
    "    unsigned long cipher_state;",
    "    struct list_head list;",
    "};",
    "",
    "static struct task_struct *mainframe_daemon = NULL;",
    "static struct socket *mainframe_sock = NULL;",
    "static LIST_HEAD(active_connections);",
    "static DEFINE_MUTEX(connection_mutex);",
    "",
    "static unsigned long decrypt_payload(unsigned char *data, size_t len,",
    "                                     unsigned long key) {",
    "    unsigned long state = key;",
    "    size_t i;",
    "",
    "    for (i = 0; i < len; i++) {",
    "        state = (state * 1103515245 + 12345) & 0x7fffffff;",
    "        data[i] ^= (unsigned char)(state >> 16);",
    "    }",
    "",
    "    return state;",
    "}",
    "",
    "static int authenticate_node(struct mainframe_connection *conn) {",
    "    unsigned char challenge[32];",
    "    unsigned char response[32];",
    "    int ret;",
    "",
    "    get_random_bytes(challenge, sizeof(challenge));",
    "",
    "    ret = kernel_sendmsg(conn->sock, &msg, &iov, 1, sizeof(challenge));",
    "    if (ret < 0) {",
    '        pr_err("MAINFRAME: Auth challenge send failed: %d\\n", ret);',
    "        return -ECOMM;",
    "    }",
    "",
    "    ret = kernel_recvmsg(conn->sock, &msg, &iov, 1,",
    "                         sizeof(response), 0);",
    "    if (ret < 0) {",
    '        pr_err("MAINFRAME: Auth response recv failed: %d\\n", ret);',
    "        return -ECOMM;",
    "    }",
    "",
    "    decrypt_payload(response, sizeof(response), CIPHER_KEY);",
    "",
    "    if (memcmp(challenge, response, sizeof(challenge)) != 0) {",
    '        pr_warn("MAINFRAME: Node authentication FAILED\\n");',
    "        return -EACCES;",
    "    }",
    "",
    '    pr_info("MAINFRAME: Node authenticated successfully\\n");',
    "    conn->status = 1;",
    "    return 0;",
    "}",
    "",
    "static int process_command(struct mainframe_connection *conn,",
    "                          const char *cmd, size_t cmd_len) {",
    "    char command_buf[256];",
    "    int ret = 0;",
    "",
    "    if (cmd_len >= sizeof(command_buf))",
    "        return -EINVAL;",
    "",
    "    memcpy(command_buf, cmd, cmd_len);",
    "    command_buf[cmd_len] = '\\0';",
    "",
    '    if (strncmp(command_buf, "TRAVERSE", 8) == 0) {',
    "        ret = traverse_network_nodes(conn, command_buf + 9);",
    '    } else if (strncmp(command_buf, "EXFIL", 5) == 0) {',
    "        ret = initiate_data_extraction(conn, command_buf + 6);",
    '    } else if (strncmp(command_buf, "INJECT", 6) == 0) {',
    "        ret = inject_payload(conn, command_buf + 7);",
    '    } else if (strncmp(command_buf, "SCAN", 4) == 0) {',
    "        ret = scan_subnet(conn, command_buf + 5);",
    '    } else if (strncmp(command_buf, "STATUS", 6) == 0) {',
    "        ret = report_system_status(conn);",
    "    } else {",
    '        pr_warn("MAINFRAME: Unknown command: %s\\n", command_buf);',
    "        ret = -EINVAL;",
    "    }",
    "",
    "    return ret;",
    "}",
    "",
    "static int traverse_network_nodes(struct mainframe_connection *conn,",
    "                                  const char *target) {",
    "    struct network_node *node;",
    "    struct routing_table *rt;",
    "    int hops = 0;",
    "",
    "    rt = lookup_routing_table(target);",
    "    if (!rt) {",
    '        pr_err("MAINFRAME: No route to target: %s\\n", target);',
    "        return -ENETUNREACH;",
    "    }",
    "",
    "    list_for_each_entry(node, &rt->path, list) {",
    "        if (node->security_level > conn->cipher_state) {",
    '            pr_warn("MAINFRAME: Insufficient clearance at hop %d\\n", hops);',
    "            return -EACCES;",
    "        }",
    "",
    "        ret = establish_tunnel(conn, node);",
    "        if (ret < 0) {",
    '            pr_err("MAINFRAME: Tunnel failed at hop %d\\n", hops);',
    "            return ret;",
    "        }",
    "",
    '        pr_info("MAINFRAME: Hop %d -> %s [OK]\\n", hops, node->addr);',
    "        hops++;",
    "    }",
    "",
    "    return hops;",
    "}",
    "",
    "static void monitor_data_streams(void) {",
    "    struct data_stream *stream;",
    "    unsigned long flags;",
    "    int active_count = 0;",
    "",
    "    spin_lock_irqsave(&stream_lock, flags);",
    "",
    "    list_for_each_entry(stream, &active_streams, list) {",
    "        if (stream->status == STREAM_ACTIVE) {",
    "            active_count++;",
    "            stream->bytes_transferred += stream->rate;",
    "",
    "            if (stream->bytes_transferred >= stream->total_size) {",
    "                stream->status = STREAM_COMPLETE;",
    '                pr_info("MAINFRAME: Stream %lu complete\\n",',
    "                        stream->id);",
    "            }",
    "        }",
    "    }",
    "",
    "    spin_unlock_irqrestore(&stream_lock, flags);",
    "}",
    "",
    "static int mainframe_daemon_fn(void *data) {",
    "    struct mainframe_connection *conn;",
    "    int ret;",
    "",
    '    pr_info("MAINFRAME: Daemon initialized on port %d\\n", MAINFRAME_PORT);',
    "",
    "    while (!kthread_should_stop()) {",
    "        ret = kernel_accept(mainframe_sock, &conn->sock, 0);",
    "        if (ret < 0) {",
    "            if (ret != -EAGAIN)",
    '                pr_err("MAINFRAME: Accept error: %d\\n", ret);',
    "            msleep(100);",
    "            continue;",
    "        }",
    "",
    "        conn = kzalloc(sizeof(*conn), GFP_KERNEL);",
    "        if (!conn) {",
    "            sock_release(conn->sock);",
    "            continue;",
    "        }",
    "",
    "        conn->cipher_state = CIPHER_KEY;",
    "",
    "        ret = authenticate_node(conn);",
    "        if (ret < 0) {",
    "            sock_release(conn->sock);",
    "            kfree(conn);",
    "            continue;",
    "        }",
    "",
    "        mutex_lock(&connection_mutex);",
    "        list_add_tail(&conn->list, &active_connections);",
    "        mutex_unlock(&connection_mutex);",
    "",
    "        while (conn->status) {",
    "            ret = kernel_recvmsg(conn->sock, &msg, &iov,",
    "                                1, BUFFER_SIZE, 0);",
    "            if (ret <= 0) break;",
    "",
    "            decrypt_payload(conn->buf, ret, conn->cipher_state);",
    "            conn->cipher_state = process_command(conn,",
    "                                                 conn->buf, ret);",
    "        }",
    "",
    "        mutex_lock(&connection_mutex);",
    "        list_del(&conn->list);",
    "        mutex_unlock(&connection_mutex);",
    "",
    "        sock_release(conn->sock);",
    "        kfree(conn);",
    "    }",
    "",
    "    return 0;",
    "}",
    "",
    "static int __init mainframe_init(void) {",
    "    struct sockaddr_in addr;",
    "    int ret;",
    "",
    '    pr_info("MAINFRAME: Initializing core systems...\\n");',
    '    pr_info("MAINFRAME: Encryption subsystem ONLINE\\n");',
    '    pr_info("MAINFRAME: Network interface ACTIVE\\n");',
    "",
    "    ret = sock_create(PF_INET, SOCK_STREAM, IPPROTO_TCP,",
    "                      &mainframe_sock);",
    "    if (ret < 0) {",
    '        pr_err("MAINFRAME: Socket creation failed\\n");',
    "        return ret;",
    "    }",
    "",
    "    memset(&addr, 0, sizeof(addr));",
    "    addr.sin_family = AF_INET;",
    "    addr.sin_port = htons(MAINFRAME_PORT);",
    "    addr.sin_addr.s_addr = htonl(INADDR_ANY);",
    "",
    "    ret = kernel_bind(mainframe_sock, (struct sockaddr *)&addr,",
    "                      sizeof(addr));",
    "    if (ret < 0) {",
    '        pr_err("MAINFRAME: Bind failed on port %d\\n", MAINFRAME_PORT);',
    "        sock_release(mainframe_sock);",
    "        return ret;",
    "    }",
    "",
    "    ret = kernel_listen(mainframe_sock, MAX_CONNECTIONS);",
    "    if (ret < 0) {",
    '        pr_err("MAINFRAME: Listen failed\\n");',
    "        sock_release(mainframe_sock);",
    "        return ret;",
    "    }",
    "",
    "    mainframe_daemon = kthread_run(mainframe_daemon_fn, NULL,",
    '                                    "mainframe_daemon");',
    "    if (IS_ERR(mainframe_daemon)) {",
    '        pr_err("MAINFRAME: Daemon creation failed\\n");',
    "        sock_release(mainframe_sock);",
    "        return PTR_ERR(mainframe_daemon);",
    "    }",
    "",
    '    pr_info("MAINFRAME: All systems operational\\n");',
    '    pr_info("MAINFRAME: Listening on port %d\\n", MAINFRAME_PORT);',
    "    return 0;",
    "}",
    "",
    "static void __exit mainframe_exit(void) {",
    "    struct mainframe_connection *conn, *tmp;",
    "",
    '    pr_info("MAINFRAME: Initiating shutdown sequence...\\n");',
    "",
    "    if (mainframe_daemon)",
    "        kthread_stop(mainframe_daemon);",
    "",
    "    mutex_lock(&connection_mutex);",
    "    list_for_each_entry_safe(conn, tmp, &active_connections, list) {",
    "        sock_release(conn->sock);",
    "        list_del(&conn->list);",
    "        kfree(conn);",
    "    }",
    "    mutex_unlock(&connection_mutex);",
    "",
    "    if (mainframe_sock)",
    "        sock_release(mainframe_sock);",
    "",
    '    pr_info("MAINFRAME: Shutdown complete\\n");',
    "}",
    "",
    "module_init(mainframe_init);",
    "module_exit(mainframe_exit);",
  ];
  // Hacker Typer approach: single corpus string, index-based slicing
  const CODE_TEXT = CODE_LINES.join("\n");
  const SPEED = 3;

  let index = 0;
  let terminalEl = null;
  let cursorEl = null;
  let shiftCount = 0;
  let altCount = 0;
  let onTypeCallback = null;
  let cursorTimer = null;
  const PROMPT =
    "> MAINFRAME INTERFACE v3.1.337\n> CONNECTION ESTABLISHED\n> TYPE TO ACCESS SYSTEM FILES...\n\n";

  function init(terminalElement, cursorElement, onType) {
    terminalEl = terminalElement;
    cursorEl = cursorElement;
    onTypeCallback = onType;
    index = 0;
    shiftCount = 0;
    altCount = 0;

    // Render initial prompt
    renderTerminal();

    // Blinking cursor
    cursorTimer = setInterval(blinkCursor, 500);

    document.addEventListener("keydown", handleKeydown);
  }

  function renderTerminal() {
    // Build the full text from prompt + typed portion of corpus
    const raw = PROMPT + CODE_TEXT.substring(0, index);
    // Convert whitespace to HTML (exactly like Hacker Typer)
    const html = raw
      .replace(/\n/g, "<br/>")
      .replace(/\t/g, "&nbsp;&nbsp;&nbsp;&nbsp;")
      .replace(/ /g, "&nbsp;");
    terminalEl.innerHTML = html;
  }

  function blinkCursor() {
    const content = terminalEl.innerHTML;
    if (content.endsWith("|")) {
      terminalEl.innerHTML = content.slice(0, -1);
    } else {
      terminalEl.innerHTML += "|";
    }
  }

  function handleKeydown(e) {
    // Don't process if mainframe isn't visible
    const mainframe = document.getElementById("mainframe");
    if (!mainframe || !mainframe.classList.contains("active")) return;

    // Check for Access Granted trigger
    if (e.key === "Shift") {
      shiftCount++;
      if (shiftCount >= 3) showAccessGranted();
      return;
    } else if (e.key === "Alt") {
      altCount++;
      if (altCount >= 3) showAccessGranted();
      return;
    }

    // Prevent default for most keys (but allow F11, etc.)
    if (e.preventDefault && e.key !== "F11") {
      if (!e.ctrlKey && !e.metaKey) {
        e.preventDefault();
      }
    }

    // Advance the index (or go back for Backspace)
    if (e.key === "Backspace") {
      if (index > 0) index -= SPEED;
    } else {
      index += SPEED;
    }

    // Loop back if we reach the end
    if (index >= CODE_TEXT.length) index = 0;
    if (index < 0) index = 0;

    // Re-render the terminal with the new index
    renderTerminal();

    // Auto-scroll to bottom
    terminalEl.scrollTop = terminalEl.scrollHeight;

    // Play type click
    AudioEngine.playTypeClick();

    // Dispatch for cityscape interaction
    if (onTypeCallback) onTypeCallback();
  }

  function showAccessGranted() {
    const overlay = document.getElementById("access-granted");
    if (overlay) {
      overlay.classList.add("active");
      setTimeout(() => overlay.classList.remove("active"), 3000);
    }
    shiftCount = 0;
    altCount = 0;
  }

  function destroy() {
    document.removeEventListener("keydown", handleKeydown);
    if (cursorTimer) clearInterval(cursorTimer);
  }

  return { init, destroy };
})();
